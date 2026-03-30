from flask import Blueprint, request, jsonify
from ..models.document import Document
from ..models.patient import Patient, PatientDocument
from ..models.metadata_result import MetadataResult
from ..extensions import db
import uuid

batch_bp = Blueprint('batch', __name__, url_prefix='/api/batch')

def normalize_identifier(id_str):
    if not id_str:
        return ""
    # Remove non-alphanumeric and leading zeros
    return ''.join(filter(str.isalnum, id_str)).lstrip('0').upper()

import re
def normalize_patient_name(name):
    if not name:
        return ""
    # Remove all whitespace (spaces, newlines, tabs)
    name = re.sub(r'\s+', '', str(name))
    # Remove common OCR labeling prefixes
    for prefix in ['患者姓名:', '患者姓名：', '患者姓名', '姓名:', '姓名：', '姓名']:
        if name.startswith(prefix):
            name = name[len(prefix):]
    # Filter common bare false positives
    if name in ['男', '女', '男/女', '主治医师', '医生', '签名', '未知', '无']:
        return ""
    return name

def get_doc_info(doc_id):
    doc = Document.query.filter_by(id=doc_id).first()
    if not doc:
        return None
        
    meta = MetadataResult.query.filter_by(document_id=doc_id, status=MetadataResult.STATUS_SUCCESS)\
                         .order_by(MetadataResult.created_at.desc()).first()
                         
    if not meta or not meta.result_json:
        return {'doc': doc, 'name': '', 'identifiers': set(), 'raw_identifiers': []}
    
    result = meta.result_json
    
    # Try multiple common keys for name
    name = ""
    for name_key in ['患者姓名', '姓名', 'patient_name', 'name']:
        if result.get(name_key):
            name = str(result.get(name_key))
            break
            
    # Apply normalization to clean up prefix and whitespace
    norm_name = normalize_patient_name(name)
    
    # Try multiple common keys for identifiers
    identifiers_raw = []
    for id_key in ['唯一标识符', 'patient_id', 'inpatient_id', 'outpatient_id', '门诊_住院号', '住院号', '门诊号', '就诊号', '病案号', '医保号', '身份证号', 'id_number']:
        val = result.get(id_key)
        if val:
            if isinstance(val, list):
                identifiers_raw.extend(val)
            else:
                identifiers_raw.append(val)
    
    identifiers = set()
    for item in identifiers_raw:
        if isinstance(item, dict):
            val = str(item.get('标识符编号', ''))
            norm_val = normalize_identifier(val)
            if norm_val:
                identifiers.add(norm_val)
        else:
            norm_val = normalize_identifier(str(item))
            if norm_val:
                identifiers.add(norm_val)
                
    return {
        'doc': doc,
        'name': norm_name,
        'identifiers': identifiers,
        'raw_identifiers': identifiers_raw,
        'result_json': result
    }

class UnionFind:
    def __init__(self, elements):
        self.parent = {e: e for e in elements}
    
    def find(self, i):
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]
    
    def union(self, i, j):
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            self.parent[root_i] = root_j

@batch_bp.route('/preflight', methods=['POST'])
def batch_preflight():
    data = request.json or {}
    doc_ids = data.get('document_ids', [])
    if not doc_ids:
        return jsonify({"success": True, "data": []})
        
    # 1. Fetch info for all docs
    doc_infos = {}
    valid_ids = []
    for did in doc_ids:
        info = get_doc_info(did)
        if info:
            doc_infos[did] = info
            valid_ids.append(did)
            
    # 2. Intra-batch Clustering (Union-Find)
    uf = UnionFind(valid_ids)
    for i in range(len(valid_ids)):
        for j in range(i+1, len(valid_ids)):
            id_a, id_b = valid_ids[i], valid_ids[j]
            info_a = doc_infos[id_a]
            info_b = doc_infos[id_b]
            
            # Match by exactly identical non-empty names
            if info_a['name'] and info_b['name'] and info_a['name'] == info_b['name']:
                uf.union(id_a, id_b)
                continue
            
            # Match by identifier intersection
            if info_a['identifiers'].intersection(info_b['identifiers']):
                uf.union(id_a, id_b)
                
    # 3. Aggregate groups
    clusters = {}
    for did in valid_ids:
        root = uf.find(did)
        if root not in clusters:
            clusters[root] = {
                'document_ids': [],
                'docs': [],
                'names': set(),
                'identifiers': set(),
                'raw_identifiers': []
            }
        
        clusters[root]['document_ids'].append(did)
        info = doc_infos[did]
        doc_dict = info['doc'].to_dict()
        doc_dict['result_json'] = info.get('result_json', {})
        clusters[root]['docs'].append(doc_dict)
        if info['name']:
            clusters[root]['names'].add(info['name'])
        clusters[root]['identifiers'].update(info['identifiers'])
        
        # Merge raw identifiers for UI presentation or patient creation
        for rid in info['raw_identifiers']:
            if rid not in clusters[root]['raw_identifiers']:
                clusters[root]['raw_identifiers'].append(rid)
                
    # 4. Match against Patient DB to determine 4-tier confidence
    all_patients = Patient.query.filter_by(is_deleted=False).all()
    results = []
    
    for root, cluster in clusters.items():
        names = list(cluster['names'])
        identifiers = cluster['identifiers']
        
        tier = 4 # Default to Orphan
        target_patients = []
        
        if not names and not identifiers:
            tier = 4
        else:
            perfect_matches = []
            high_conf_matches = []
            
            cluster_name = names[0] if len(names) == 1 else None
            
            for p in all_patients:
                p_name = p.metadata_json.get('患者姓名', '') or ''
                p_name = normalize_patient_name(p_name)
                p_identifiers_raw = p.identifiers or []
                p_idents = {normalize_identifier(pid) for pid in p_identifiers_raw if pid}
                    
                name_match = (cluster_name and p_name == cluster_name)
                id_intersect = bool(identifiers.intersection(p_idents))
                
                if name_match and id_intersect:
                    perfect_matches.append(p)
                elif name_match or id_intersect:
                    high_conf_matches.append(p)
                    
            if perfect_matches and len(perfect_matches) == 1:
                tier = 1
                target_patients = [perfect_matches[0].to_dict()]
            elif perfect_matches and len(perfect_matches) > 1:
                tier = 2 # Multiple perfect matches is a conflict
                target_patients = [p.to_dict() for p in perfect_matches]
            elif high_conf_matches:
                tier = 2
                target_patients = [p.to_dict() for p in high_conf_matches]
            else:
                tier = 3 # New Patient
                
        # If clustered docs have conflicting names, downgrade to Tier 2
        if len(names) > 1 and tier in [1, 3]:
            tier = 2
            
        results.append({
            'cluster_id': root,
            'documents': cluster['docs'],
            'aggregated_names': names,
            'aggregated_identifiers': list(identifiers),
            'raw_identifiers': cluster['raw_identifiers'],
            'tier': tier,
            'suggested_patients': target_patients
        })
        
    return jsonify({
        "success": True,
        "data": results
    })

@batch_bp.route('/commit', methods=['POST'])
def batch_commit():
    """
    Expects JSON:
    Single cluster commit (from AIProcessing):
    {
       "action": "CREATE_PATIENT" | "ASSIGN",
       "patient_id": "...", # Optional if ASSIGN
       "document_ids": ["..."],
       "final_metadata": { "姓名": "张三", "联系电话": "123", ... },
       "final_identifiers": ["ID1", "ID2"],
       "source": "AUTO" | "MANUAL"
    }
    
    OR assignments array (from DocumentDetailModal):
    {
       "assignments": [
           {
               "action": "ASSIGN", 
               "patient_id": "...", 
               "document_id": "...", 
               "source": "MANUAL_MODAL"
           }
       ]
    }
    """
    data = request.json or {}
    
    tasks = []
    if 'assignments' in data:
        for assign in data['assignments']:
            # Normalizing assign payload
            tasks.append({
                'action': assign.get('action'),
                'patient_id': assign.get('patient_id'),
                'document_ids': [assign.get('document_id')] if assign.get('document_id') else [],
                'final_metadata': assign.get('final_metadata', {}),
                'final_identifiers': assign.get('final_identifiers', []),
                'source': assign.get('source', 'MANUAL_MODAL')
            })
    else:
        tasks.append({
            'action': data.get('action'),
            'patient_id': data.get('patient_id'),
            'document_ids': data.get('document_ids', []),
            'final_metadata': data.get('final_metadata', {}),
            'final_identifiers': data.get('final_identifiers', []),
            'source': data.get('source', 'MANUAL_BATCH')
        })
        
    for task in tasks:
        action = task['action']
        patient_id = task['patient_id']
        document_ids = task['document_ids']
        final_metadata = task['final_metadata']
        final_identifiers = task['final_identifiers']
        source = task['source']
        
        if not document_ids:
            continue
            
        if action == 'CREATE_PATIENT':
            patient = Patient(
                metadata_json=final_metadata,
                identifiers=final_identifiers
            )
            db.session.add(patient)
            db.session.flush()
            patient_id = patient.id
        elif action == 'ASSIGN':
            patient = Patient.query.get(patient_id)
            if patient:
                # Only merge metadata if caller actually provided values;
                # an empty dict means "don't touch existing metadata" (e.g. modal rebind)
                if final_metadata:
                    existing_meta = patient.metadata_json or {}
                    merged = {**existing_meta, **final_metadata}
                    patient.metadata_json = merged
                existing_ids = patient.identifiers
                if not isinstance(existing_ids, list):
                    existing_ids = []
                if final_identifiers:
                    patient.identifiers = list(set(existing_ids + final_identifiers))
                
        if not patient_id:
            return jsonify({"success": False, "message": "Could not determine patient"}), 400
            
        # Link doc and update doc status
        old_patient_ids = set()  # Track old patients that need count updates
        for doc_id in document_ids:
            doc = Document.query.get(doc_id)
            if not doc:
                continue
            
            # Soft-delete any existing links to OTHER patients (re-binding)
            old_links = PatientDocument.query.filter(
                PatientDocument.document_id == doc_id,
                PatientDocument.patient_id != patient_id,
                PatientDocument.is_deleted == False
            ).all()
            for old_link in old_links:
                old_patient_ids.add(old_link.patient_id)
                old_link.is_deleted = True
                
            # Check for a soft-deleted record (same patient+doc) and reactivate it
            deleted_pd = PatientDocument.query.filter_by(patient_id=patient_id, document_id=doc_id, is_deleted=True).first()
            
            # Dynamic metadata extraction
            meta = MetadataResult.query.filter_by(document_id=doc_id, status=MetadataResult.STATUS_SUCCESS).order_by(MetadataResult.created_at.desc()).first()
            result = meta.result_json if meta and meta.result_json else {}
            
            dt = ""
            if result.get('文档分类'):
                if isinstance(result['文档分类'], dict):
                    dt = result['文档分类'].get('主类型', '')
                    sub = result['文档分类'].get('子类型', '')
                    if sub: dt = f"{dt} - {sub}"
                else:
                    dt = str(result['文档分类'])
            elif result.get('主类型'):
                dt = str(result['主类型'])
                sub = result.get('子类型', '')
                if sub: dt = f"{dt} - {str(sub)}"
            elif result.get('document_type'):
                dt = str(result['document_type'])
            elif result.get('doc_type'):
                dt = str(result['doc_type'])
            elif result.get('类型'):
                dt = str(result['类型'])
            
            ddate = result.get('文档生效日期') or result.get('报告日期') or result.get('检查日期') or result.get('报告时间') or result.get('collection_time') or result.get('report_date') or ''
            
            if deleted_pd:
                # Reactivate the soft-deleted link
                deleted_pd.is_deleted = False
                deleted_pd.doc_type = dt.strip() if dt else result.get('文档类型')
                deleted_pd.doc_subtype = result.get('文档子类型')
                deleted_pd.doc_title = result.get('文档标题')
                deleted_pd.doc_date = str(ddate).strip()
                deleted_pd.source = source
            else:
                pd = PatientDocument(
                    patient_id=patient_id,
                    document_id=doc_id,
                    doc_type=dt.strip() if dt else result.get('文档类型'),
                    doc_subtype=result.get('文档子类型'),
                    doc_title=result.get('文档标题'),
                    doc_date=str(ddate).strip(),
                    source=source
                )
                db.session.add(pd)
                
            if doc.status != 'ARCHIVED':
                doc.status = 'ARCHIVED'
                
        # Update Document Count for new patient
        patient_model = Patient.query.get(patient_id)
        if patient_model:
            patient_model.document_count = PatientDocument.query.filter_by(patient_id=patient_id, is_deleted=False).count()
        
        # Update Document Count for old patients (re-binding)
        for old_pid in old_patient_ids:
            old_patient = Patient.query.get(old_pid)
            if old_patient:
                old_patient.document_count = PatientDocument.query.filter_by(patient_id=old_pid, is_deleted=False).count()
            
    db.session.commit()
    return jsonify({"success": True})
