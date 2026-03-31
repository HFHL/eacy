import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app import create_app
from app.extensions import db
from app.models.document import Document
from app.api.batch import batch_preflight, get_doc_info, UnionFind

app = create_app()
with app.app_context():
    # Identify the user
    user_id = 2  # feiyuzi
    docs = Document.query.filter_by(uploader_id=user_id, status='EXTRACT_DONE').all()
    if not docs:
        print("No EXTRACT_DONE documents found for user 2.")
        sys.exit(0)
    
    doc_ids = [d.id for d in docs]
    print(f"Testing preflight for document IDs: {doc_ids}")
    
    # 1. Fetch info
    doc_infos = {}
    valid_ids = []
    for did in doc_ids:
        try:
            info = get_doc_info(did)
            if info:
                doc_infos[did] = info
                valid_ids.append(did)
        except Exception as e:
            print(f"Error in get_doc_info for {did}: {e}")
            sys.exit(1)
            
    print(f"Valid IDs after get_doc_info: {valid_ids}")
    
    # Simulate the rest of the logic...
    try:
        from app.models.patient import Patient
        from app.api.batch import normalize_patient_name, normalize_identifier
        
        uf = UnionFind(valid_ids)
        for i in range(len(valid_ids)):
            for j in range(i+1, len(valid_ids)):
                id_a, id_b = valid_ids[i], valid_ids[j]
                info_a = doc_infos[id_a]
                info_b = doc_infos[id_b]
                if info_a['name'] and info_b['name'] and info_a['name'] == info_b['name']:
                    uf.union(id_a, id_b)
                    continue
                if info_a['identifiers'].intersection(info_b['identifiers']):
                    uf.union(id_a, id_b)
                    
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
            clusters[root]['names'].add(info['name'])
            clusters[root]['identifiers'].update(info['identifiers'])
            for rid in info['raw_identifiers']:
                if rid not in clusters[root]['raw_identifiers']:
                    clusters[root]['raw_identifiers'].append(rid)
        
        all_patients = Patient.query.filter_by(is_deleted=False, uploader_id=user_id).all()
        
        results = []
        for root, cluster in clusters.items():
            names = list(cluster['names'])
            identifiers = cluster['identifiers']
            for p in all_patients:
                p_name = p.metadata_json.get('患者姓名', '') or ''
                p_name = normalize_patient_name(p_name)
                p_identifiers_raw = p.identifiers or []
                p_idents = {normalize_identifier(pid) for pid in p_identifiers_raw if pid}
        print("Success! Preflight simulation completed without errors.")
    except Exception as e:
        import traceback
        traceback.print_exc()

