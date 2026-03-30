/**
 * Schema解析器 - 将JSON Schema转换为设计器内部数据结构
 */

import { DISPLAY_TYPES, DEFAULT_CONFIG } from './constants';

/**
 * Schema解析器类
 */
export class SchemaParser {
  /**
   * 按 x-property-order 遍历 properties（兼容 PostgreSQL JSONB 重排 object key 后丢失的 CSV/设计器顺序）。
   */
  static _orderedPropertyEntries(properties, parentNode) {
    if (!properties || typeof properties !== 'object') return [];
    const order = parentNode && parentNode['x-property-order'];
    if (Array.isArray(order) && order.length > 0) {
      const seen = new Set();
      const out = [];
      for (const k of order) {
        if (Object.prototype.hasOwnProperty.call(properties, k) && !seen.has(k)) {
          out.push([k, properties[k]]);
          seen.add(k);
        }
      }
      for (const k of Object.keys(properties)) {
        if (!seen.has(k)) {
          out.push([k, properties[k]]);
          seen.add(k);
        }
      }
      return out;
    }
    return Object.entries(properties);
  }

  /**
   * 解析完整Schema
   * @param {Object} schema - JSON Schema对象
   * @returns {Object} 设计器数据模型
   */
  static parseSchema(schema) {
    const enums = this._parseEnums(schema);
    const designModel = {
      meta: this._parseMeta(schema),
      folders: this._parseFolders(schema, enums),
      enums,
      selectedFolderId: null,
      selectedGroupId: null,
      selectedFieldId: null,
      expandedFolderIds: [],
      expandedGroupIds: []
    };

    // 默认展开第一个文件夹和第一个字段组
    if (designModel.folders.length > 0) {
      designModel.expandedFolderIds.push(designModel.folders[0].id);
      if (designModel.folders[0].groups.length > 0) {
        designModel.expandedGroupIds.push(designModel.folders[0].groups[0].id);
      }
    }

    return designModel;
  }

  /**
   * 解析Schema元信息
   */
  static _parseMeta(schema) {
    return {
      $id: schema.$id || 'untitled.schema.json',
      $schema: schema.$schema,
      version: schema['x-schema-meta']?.version || '1.0.0',
      projectId: schema['x-schema-meta']?.projectId || '',
      created: schema['x-schema-meta']?.created || null,
      modified: schema['x-schema-meta']?.modified || null,
      author: schema['x-schema-meta']?.author || '',
      description: schema['x-schema-meta']?.description || ''
    };
  }

  /**
   * 解析文件夹和字段组结构
   */
  static _parseFolders(schema, enums) {
    const folders = [];

    if (!schema.properties) return folders;

    for (const [folderName, folderSchema] of this._orderedPropertyEntries(schema.properties, schema)) {
      const folder = {
        id: this._generateId('folder'),
        name: folderName,
        groups: []
      };

      // 解析字段组（层级1，必须是group或object类型）
      for (const [groupName, groupSchema] of this._orderedPropertyEntries(folderSchema.properties || {}, folderSchema)) {
        const group = this._parseGroup(groupName, groupSchema, folderName, enums);
        folder.groups.push(group);
      }

      folders.push(folder);
    }

    return folders;
  }

  /**
   * 解析单个字段组
   */
  static _parseGroup(name, schema, folderName, enums) {
    const isRepeatable = schema.type === 'array';
    const target = isRepeatable ? schema.items : schema;
    const required = isRepeatable ? (schema.items?.required || []) : (schema?.required || []);

    const group = {
      id: this._generateId('group'),
      uid: target['x-group-uid'] || null,
      name: name,
      displayName: name,
      type: this._parseGroupType(schema),
      repeatable: isRepeatable,
      isExtractionUnit: !!target['x-sources'],
      mergeBinding: target['x-merge-binding'] || null,
      sources: target['x-sources'] || null,
      formTemplate: target['x-form-template'] || null,
      fields: this._parseFields(target, required, folderName, name, enums),
      config: {
        tableRows: this._parseTableRows(schema)
      },
      required: required || []
    };

    return group;
  }

  /**
   * 解析字段组类型
   */
  static _parseGroupType(schema) {
    if (schema['x-display']) {
      return schema['x-display'];
    }
    // 如果是array类型，默认为group（可重复表单）
    if (schema.type === 'array') {
      return DISPLAY_TYPES.GROUP;
    }
    return DISPLAY_TYPES.GROUP;
  }

  /**
   * 解析字段列表
   */
  static _parseFields(groupSchema, required, folderName, groupName, enums) {
    const fields = [];

    if (!groupSchema.properties) return fields;

    for (const [fieldName, fieldSchema] of this._orderedPropertyEntries(groupSchema.properties, groupSchema)) {
      // 处理嵌套的子表格
      if (fieldSchema.type === 'object' || (fieldSchema.type === 'array' &&
          fieldSchema.items?.type === 'object')) {
        // 这可以是一个嵌套表格，递归处理
        // 关键：对 array 类型，列定义在 items 里；对 object 类型，列定义在自身
        const nestedTarget = fieldSchema.type === 'array' ? fieldSchema.items : fieldSchema;
        const nestedRequired = nestedTarget?.required || [];
        const nestedFields = this._parseFields(nestedTarget, nestedRequired, folderName, `${groupName}/${fieldName}`, enums);
        if (nestedFields.length > 0) {
          // 创建一个table类型的容器字段
          const _isMultiRow = fieldSchema.type === 'array';
          fields.push({
            id: this._generateId('field'),
            uid: fieldSchema['x-field-uid'] || null,
            fieldId: fieldSchema['x-field-id'] || fieldSchema['x-field-uid'] || null,
            name: fieldName,
            displayName: fieldName,
            displayType: DISPLAY_TYPES.TABLE,
            dataType: 'array',
            repeatable: _isMultiRow,
            multiRow: _isMultiRow,
            isTable: true,
            nullable: true,
            sensitive: !!fieldSchema['x-sensitive'],
            primary: !!fieldSchema['x-primary'],
            editable: fieldSchema['x-editable'] !== false,
            warnOnConflict: fieldSchema['x-warn-on-conflict'] !== false,
            description: fieldSchema.description || '',
            required: false,
            children: nestedFields,
            config: {
              tableRows: _isMultiRow ? 'multiRow' : 'singleRow'
            }
          });
        }
        continue;
      }

      const field = this._parseField(fieldName, fieldSchema, required.includes(fieldName), enums);
      fields.push(field);
    }

    return fields;
  }

  /**
   * 解析单个字段
   */
  static _parseField(name, schema, isRequired = false, enums = {}) {
    const displayType = schema['x-display'] || this._inferDisplayType(schema);
    const dataType = schema.type || this._inferDataType(displayType);
    const options = this._parseOptions(schema, enums);

    return {
      id: this._generateId('field'),
      uid: schema['x-field-uid'] || null,
      fieldId: schema['x-field-id'] || schema['x-field-uid'] || null,
      name: name,
      displayName: schema['x-display-name'] || name,
      displayType: displayType,
      dataType: dataType,
      options: options,
      optionsId: schema['x-options-id'] || this._inferOptionsId(schema) || null,
      unit: schema['x-unit'] || null,
      nullable: !isRequired,
      sensitive: !!schema['x-sensitive'],
      primary: !!schema['x-primary'],
      editable: schema['x-editable'] !== false,
      warnOnConflict: schema['x-warn-on-conflict'] !== false,
      formTemplate: schema['x-form-template'] || null,
      fileType: schema['x-file-type'] || null,
      description: schema.description || '',
      extractionPrompt: schema['x-extraction-prompt'] || '',
      conflictPolicy: schema['x-conflict-policy'] || null,
      required: isRequired,
      format: schema.format || null,
      defaultValue: schema.default || null,
      children: null,
      config: this._parseExtendedConfig(schema),
      category: 'single'
    };
  }

  /**
   * 从 allOf/$ref 推断 optionsId（#/$defs/<id>）
   */
  static _inferOptionsId(schema) {
    const ref = schema?.allOf?.[0]?.$ref;
    if (typeof ref === 'string') {
      const m = ref.match(/^#\/\$defs\/(.+)$/);
      if (m && m[1]) return m[1];
    }
    // array items 的 ref（多选）
    const itemRef = schema?.items?.allOf?.[0]?.$ref;
    if (typeof itemRef === 'string') {
      const m = itemRef.match(/^#\/\$defs\/(.+)$/);
      if (m && m[1]) return m[1];
    }
    return null;
  }

  /**
   * 推断展示类型
   */
  static _inferDisplayType(schema) {
    // enum 直接定义
    if (schema.enum) return DISPLAY_TYPES.SELECT;
    // enum 引用（很多 schema 只写 allOf $ref）
    if (schema.allOf && schema.allOf[0]?.$ref) return DISPLAY_TYPES.SELECT;
    // 日期/时间
    if (schema.format === 'date' || schema.format === 'date-time') return DISPLAY_TYPES.DATE;
    if (schema.type === 'number') return DISPLAY_TYPES.NUMBER;
    if (schema.type === 'array') {
      // 多选：items.enum 或 items.$ref
      if (schema.items?.enum || schema.items?.allOf?.[0]?.$ref) return DISPLAY_TYPES.CHECKBOX;
      return DISPLAY_TYPES.CHECKBOX;
    }
    if (schema['x-display']) return schema['x-display'];
    return DISPLAY_TYPES.TEXT;
  }

  /**
   * 推断数据类型
   */
  static _inferDataType(displayType) {
    const typeMap = {
      [DISPLAY_TYPES.NUMBER]: 'number',
      [DISPLAY_TYPES.CHECKBOX]: 'array',
      [DISPLAY_TYPES.MULTISELECT]: 'array',
      [DISPLAY_TYPES.DATE]: 'string'
    };
    return typeMap[displayType] || 'string';
  }

  /**
   * 解析选项值
   */
  static _parseOptions(schema, enums = {}) {
    // 优先从枚举定义获取
    if (schema.enum) {
      return [...schema.enum];
    }
    // 数组多选：items.enum
    if (schema.type === 'array' && schema.items?.enum) {
      return [...schema.items.enum];
    }
    // 从allOf引用获取（需要配合$defs解析）
    if (schema.allOf && schema.allOf[0]?.$ref) {
      const ref = schema.allOf[0].$ref;
      if (typeof ref === 'string') {
        const m = ref.match(/^#\/\$defs\/(.+)$/);
        const enumId = m && m[1] ? m[1] : null;
        if (enumId && enums && enums[enumId] && Array.isArray(enums[enumId].values)) {
          return [...enums[enumId].values];
        }
      }
      return null;
    }
    // 数组：items.allOf 引用
    if (schema.type === 'array' && schema.items?.allOf?.[0]?.$ref) {
      const ref = schema.items.allOf[0].$ref;
      if (typeof ref === 'string') {
        const m = ref.match(/^#\/\$defs\/(.+)$/);
        const enumId = m && m[1] ? m[1] : null;
        if (enumId && enums && enums[enumId] && Array.isArray(enums[enumId].values)) {
          return [...enums[enumId].values];
        }
      }
      return null;
    }
    return null;
  }

  /**
   * 解析枚举定义
   */
  static _parseEnums(schema) {
    const enums = {};
    if (schema.$defs) {
      for (const [enumId, enumDef] of Object.entries(schema.$defs)) {
        if (enumDef.enum) {
          enums[enumId] = {
            id: enumId,
            type: enumDef.type || 'string',
            values: [...enumDef.enum]
          };
        }
      }
    }
    return enums;
  }

  /**
   * 解析扩展配置
   */
  static _parseExtendedConfig(schema) {
    if (!schema['x-extended-config']) return null;
    try {
      return typeof schema['x-extended-config'] === 'string'
        ? JSON.parse(schema['x-extended-config'])
        : schema['x-extended-config'];
    } catch (e) {
      console.error('Failed to parse extended config:', e);
      return null;
    }
  }

  /**
   * 解析table行数配置
   */
  static _parseTableRows(schema) {
    const config = schema['x-extended-config'];
    if (config?.tableRows) {
      return config.tableRows;
    }
    // 如果是array类型，默认多行
    if (schema.type === 'array') return 'multiRow';
    return 'singleRow';
  }

  /**
   * 生成临时ID
   */
  static _generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default SchemaParser;
