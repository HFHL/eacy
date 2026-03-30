// Removed legacy import
// import { getCrfDocTypes } from '../../../api/crfTemplate'
export const mapDisplayType = (displayType) => {
  switch (displayType) {
    case 'text':
    case 'textarea':
    case 'number':
    case 'date':
    case 'radio':
    case 'checkbox':
    case 'select':
    case 'file':
      return displayType
    case 'multiselect':
      return 'checkbox'
    default:
      return 'text'
  }
}

const buildGroupDisplayName = (folderName, groupName, includeFolderPrefix = true) => {
  if (!includeFolderPrefix) return groupName || ''
  return [folderName, groupName].filter(Boolean).join(' / ')
}

const flattenDesignerField = (field, parentPath = '') => {
  if (!field) return []
  const thisName = field.name || ''
  const nextParent = parentPath ? `${parentPath}/${thisName}` : thisName
  if (Array.isArray(field.children) && field.children.length > 0) {
    let flattened = []
    field.children.forEach((child) => {
      flattened = flattened.concat(flattenDesignerField(child, nextParent))
    })
    return flattened
  }
  return [{ field, parentPath }]
}

const normalizeFieldId = (field, fallbackFieldId) => {
  let fieldId = field.fieldId || field.field_id || ''
  if (fieldId && field.name) {
    const parts = String(fieldId).split('/')
    const lastPart = parts[parts.length - 1]
    if (lastPart !== field.name) {
      parts[parts.length - 1] = field.name
      fieldId = parts.join('/')
    }
  }
  return fieldId || fallbackFieldId || field.uid || field.fieldUid || field.field_uid || ''
}

export const buildFieldGroupsForBackend = (designData, options = {}) => {
  const { includeFolderPrefix = true, orderOffsetPerFolder = 100 } = options
  const groups = []
  const folders = designData?.folders || []

  folders.forEach((folder, folderIndex) => {
    const folderGroups = folder.groups || []
    folderGroups.forEach((group, groupIndex) => {
      const groupDisplayName = buildGroupDisplayName(folder?.name || '', group?.name || '', includeFolderPrefix)
      const primarySources = group.primarySources || group.sources?.primary || []
      const secondarySources = group.secondarySources || group.sources?.secondary || []

      const fields = (group.fields || [])
        .flatMap((field) => flattenDesignerField(field, ''))
        .map(({ field, parentPath }) => {
          const validation = {}
          if (field.minimum !== undefined && field.minimum !== null) validation.min = field.minimum
          if (field.maximum !== undefined && field.maximum !== null) validation.max = field.maximum
          if (field.pattern) validation.pattern = field.pattern

          const composedPath = parentPath ? `${parentPath}/${field?.name || ''}` : (field?.name || '')
          const fallbackFieldId = [folder?.name || '', group?.name || '', composedPath].filter(Boolean).join('/')

          return {
            name: field.name,
            displayName: field.displayName || field.name,
            type: mapDisplayType(field.displayType),
            required: !!field.required,
            options: field.options || [],
            validation,
            aiPrompt: field.extractionPrompt || '',
            description: field.description || '',
            unit: field.unit || '',
            sensitive: !!field.sensitive,
            primary: !!field.primary,
            editable: field.editable !== false,
            conflictPolicy: field.conflictPolicy || '',
            warnOnConflict: field.warnOnConflict !== false,
            fieldUid: field.uid || field.fieldUid || field.field_uid,
            fieldId: normalizeFieldId(field, fallbackFieldId),
            formTemplate: field.formTemplate || {},
            fileType: field.fileType || '',
            formName: group.name,
            category: 'form',
            extConfig: field.config || {},
            mergeBinding: field.mergeBinding || ''
          }
        })

      groups.push({
        name: groupDisplayName || group.name,
        repeatable: !!group.repeatable,
        order: group.order ?? (folderIndex + 1) * orderOffsetPerFolder + (groupIndex + 1),
        description: group.description || '',
        mergeBinding: group.mergeBinding || '',
        extConfig: group.formTemplate || group.config || {},
        _sourcesByDocType: {
          [group.name]: { primary: primarySources, secondary: secondarySources }
        },
        fields
      })
    })
  })

  return groups
}

const countDesignerLeafFields = (designer) => {
  if (!designer?.folders || !Array.isArray(designer.folders)) return 0
  let count = 0
  const walkField = (field) => {
    if (!field) return
    if (Array.isArray(field.children) && field.children.length > 0) {
      field.children.forEach(walkField)
      return
    }
    count += 1
  }
  designer.folders.forEach((folder) => {
    ;(folder.groups || []).forEach((group) => {
      ;(group.fields || []).forEach(walkField)
    })
  })
  return count
}

const analyzeSchema = (schema) => {
  const stats = {
    leafCount: 0,
    complexCount: 0
  }
  const walk = (node) => {
    if (!node || typeof node !== 'object') return
    if (node.type === 'object' && node.properties && typeof node.properties === 'object') {
      const propertyValues = Object.values(node.properties)
      const hasNestedObject = propertyValues.some((child) => child && typeof child === 'object' && (child.type === 'object' || child.type === 'array'))
      if (hasNestedObject) stats.complexCount += 1
      propertyValues.forEach(walk)
      return
    }
    if (node.type === 'array' && node.items && typeof node.items === 'object') {
      stats.complexCount += 1
      walk(node.items)
      return
    }
    stats.leafCount += 1
  }
  walk(schema)
  return stats
}

const designerHasComplexStructures = (designer) => {
  if (!designer?.folders || !Array.isArray(designer.folders)) return false
  return designer.folders.some((folder) =>
    (folder.groups || []).some((group) =>
      (group.fields || []).some((field) => Array.isArray(field.children) && field.children.length > 0)
    )
  )
}

const shouldPreferSchema = ({ designer, schema, mode }) => {
  if (!schema) return false
  if (mode === 'schema') return true
  if (mode === 'designer') return false
  if (!designer?.folders || !Array.isArray(designer.folders) || designer.folders.length === 0) return true

  const designerLeafCount = countDesignerLeafFields(designer)
  const schemaStats = analyzeSchema(schema)
  if (designerLeafCount === 0 && schemaStats.leafCount > 0) return true
  if (schemaStats.leafCount > designerLeafCount) return true
  if (schemaStats.complexCount > 0 && !designerHasComplexStructures(designer)) return true
  return false
}

export const loadTemplateIntoDesigner = async (formDesignerRef, { designer, schema, mode = 'auto' } = {}) => {
  if (!formDesignerRef?.current) return null
  if (shouldPreferSchema({ designer, schema, mode })) {
    await formDesignerRef.current.loadSchema(schema)
    return 'schema'
  }
  if (designer?.folders) {
    formDesignerRef.current.loadData(designer)
    return 'designer'
  }
  if (schema) {
    await formDesignerRef.current.loadSchema(schema)
    return 'schema'
  }
  return null
}

export const fetchCrfDocTypeOptions = async () => {
  return [
    { label: '体格检查', value: '体格检查' },
    { label: '病程记录', value: '病程记录' },
    { label: '出院记录', value: '出院记录' },
    { label: '检查报告', value: '检查报告' },
    { label: '检验报告', value: '检验报告' },
    { label: '手术记录', value: '手术记录' }
  ];
}
