/**
 * Schema生成器 - 将设计器数据转换为JSON Schema
 */

import { DISPLAY_TYPES } from './constants';

/**
 * Schema生成器类
 */
export class SchemaGenerator {
  /**
   * 生成完整Schema
   * @param {Object} designModel - 设计器数据模型
   * @returns {Object} JSON Schema对象
   */
  static generateSchema(designModel) {
    const schema = {
      "$schema": designModel.meta.$schema || "https://json-schema.org/draft/2020-12/schema",
      "$id": designModel.meta.$id || "generated.schema.json",
      "type": "object",
      "unevaluatedProperties": false,
      "properties": this._generateProperties(designModel.folders),
      "$defs": this._generateDefs(designModel.enums),
      "x-schema-meta": this._generateMeta(designModel)
    };

    return schema;
  }

  /**
   * 生成properties（文件夹结构）
   */
  static _generateProperties(folders) {
    const properties = {};

    for (const folder of folders) {
      properties[folder.name] = {
        type: "object",
        properties: {},
        unevaluatedProperties: false
      };

      // 生成字段组
      for (const group of folder.groups) {
        properties[folder.name].properties[group.name] =
          this._generateGroup(group);
      }
    }

    return properties;
  }

  /**
   * 生成字段组Schema
   */
  static _generateGroup(group) {
    const isRepeatable = group.repeatable;
    const schema = {
      type: isRepeatable ? "array" : "object",
      ...(isRepeatable ? {
        items: {
          type: "object",
          properties: {},
          unevaluatedProperties: false,
          required: []
        }
      } : {
        properties: {},
        unevaluatedProperties: false,
        required: []
      })
    };

    // 获取目标对象（array的items或object本身）
    const target = isRepeatable ? schema.items : schema;

    // 添加字段
    const requiredFields = [];
    for (const field of group.fields) {
      // 如果是table类型字段，特殊处理
      if (field.isTable && field.children) {
        const tableSchema = this._generateTableField(field);
        target.properties[field.name] = tableSchema;
      } else {
        const fieldSchema = this._generateField(field);
        target.properties[field.name] = fieldSchema;

        // 添加到required（如果必填）
        if (field.required && !field.nullable) {
          requiredFields.push(field.name);
        }
      }
    }

    if (requiredFields.length > 0) {
      target.required = requiredFields;
    }

    // 添加x-扩展字段
    if (group.mergeBinding) {
      target["x-merge-binding"] = group.mergeBinding;
    }
    if (group.sources) {
      target["x-sources"] = group.sources;
    }
    
    // 确保可重复组表单在 schema 里体现为 multi_row
    let formTemplate = group.formTemplate || {};
    if (group.repeatable) {
      formTemplate = { ...formTemplate, row_type: 'multi_row' };
    }
    if (Object.keys(formTemplate).length > 0) {
      target["x-form-template"] = formTemplate;
    }

    if (group.uid) {
      target["x-group-uid"] = group.uid;
    }
    if (group.config?.tableRows) {
      const extConfig = {};
      if (group.config.tableRows === 'singleRow') {
        extConfig.tableRows = 'singleRow';
      } else {
        extConfig.tableRows = 'multiRow';
      }
      if (Object.keys(extConfig).length > 0) {
        target["x-extended-config"] = extConfig;
      }
    }

    // 添加x-display用于标识group/table
    if (group.type) {
      target["x-display"] = group.type;
    }

    return schema;
  }

  /**
   * 生成table字段Schema
   */
  static _generateTableField(field) {
    const isMultiRow = field.config?.tableRows === 'multiRow';
    const schema = {
      type: isMultiRow ? "array" : "object",
      ...(isMultiRow ? {
        items: {
          type: "object",
          properties: {},
          unevaluatedProperties: false
        }
      } : {
        properties: {},
        unevaluatedProperties: false
      })
    };

    const target = isMultiRow ? schema.items : schema;

    // 添加子字段
    for (const childField of field.children) {
      target.properties[childField.name] = this._generateField(childField);
    }

    // 添加x-扩展字段
    if (field.uid) {
      schema["x-field-uid"] = field.uid;
    }
    if (field.fieldId) {
      schema["x-field-id"] = field.fieldId;
    }
    if (field.displayName) {
      schema["x-display-name"] = field.displayName;
    }
    if (field.sensitive) {
      schema["x-sensitive"] = true;
    }
    if (field.primary) {
      schema["x-primary"] = true;
    }
    if (field.warnOnConflict === false) {
      schema["x-warn-on-conflict"] = false;
    }
    if (field.config?.tableRows) {
      const extConfig = schema["x-extended-config"] || {};
      extConfig.tableRows = field.config.tableRows;
      schema["x-extended-config"] = extConfig;
    }
    if (field.formTemplate) {
      schema["x-form-template"] = field.formTemplate;
    }
    if (field.fileType) {
      schema["x-file-type"] = field.fileType;
    }

    // 添加x-display标识为table
    schema["x-display"] = DISPLAY_TYPES.TABLE;

    return schema;
  }

  /**
   * 生成字段Schema
   */
  static _generateField(field) {
    let schema = {
      type: field.dataType || "string"
    };

    // 添加format
    if (field.format) {
      schema.format = field.format;
    }

    // 添加枚举
    if (field.options && field.options.length > 0) {
      if (field.displayType === DISPLAY_TYPES.CHECKBOX ||
          field.displayType === DISPLAY_TYPES.MULTISELECT) {
        schema.type = "array";
        schema.items = {
          type: "string",
          enum: field.options
        };
      } else {
        schema.type = "string";
        schema.enum = field.options;
      }

      // 如果有optionsId，添加allOf引用
      if (field.optionsId) {
        const ref = { "$ref": `#/$defs/${field.optionsId}` };
        schema.allOf = [ref];
      }
    }

    // 添加x-扩展字段
    if (field.uid) {
      schema["x-field-uid"] = field.uid;
    }
    if (field.fieldId) {
      schema["x-field-id"] = field.fieldId;
    }
    if (field.displayName) {
      schema["x-display-name"] = field.displayName;
    }
    if (field.unit) {
      schema["x-unit"] = field.unit;
    }
    if (field.sensitive) {
      schema["x-sensitive"] = true;
    }
    if (field.primary) {
      schema["x-primary"] = true;
    }
    if (!field.editable) {
      schema["x-editable"] = false;
    }
    if (field.displayType) {
      schema["x-display"] = field.displayType;
    }
    if (field.description) {
      schema.description = field.description;
    }
    if (field.extractionPrompt) {
      schema["x-extraction-prompt"] = field.extractionPrompt;
    }
    if (field.conflictPolicy) {
      schema["x-conflict-policy"] = field.conflictPolicy;
    }
    if (field.warnOnConflict === false) {
      schema["x-warn-on-conflict"] = false;
    }
    if (field.config) {
      schema["x-extended-config"] = field.config;
    }
    if (field.formTemplate) {
      schema["x-form-template"] = field.formTemplate;
    }
    if (field.fileType) {
      schema["x-file-type"] = field.fileType;
    }
    if (field.defaultValue) {
      schema.default = field.defaultValue;
    }

    return schema;
  }

  /**
   * 生成枚举定义
   */
  static _generateDefs(enums) {
    const defs = {};
    for (const [enumId, enumData] of Object.entries(enums)) {
      defs[enumId] = {
        type: enumData.type || "string",
        enum: enumData.values
      };
    }
    return defs;
  }

  /**
   * 生成元信息
   */
  static _generateMeta(designModel) {
    return {
      version: designModel.meta.version,
      created: designModel.meta.created || new Date().toISOString(),
      modified: new Date().toISOString(),
      projectId: designModel.meta.projectId,
      author: designModel.meta.author || '',
      description: designModel.meta.description || ''
    };
  }

  /**
   * 生成CSV数据
   * @param {Object} designModel - 设计器数据模型
   * @returns {Array} CSV行数据数组
   */
  static generateCSV(designModel) {
    const rows = [];

    // CSV表头
    const headers = [
      '文件（访视层）',
      '层级1（表单层）',
      '层级2', '层级3', '层级4', '层级5', '层级6', '层级7', '层级8', '层级9', '层级10',
      '展示类型',
      '可选项值',
      '数据类型',
      '数据单位',
      'group是否可重复',
      'table是否多行',
      '是否为抽取单位组',
      '主要来源',
      '次要来源',
      '时间属性字段组绑定',
      '是否为敏感字段',
      '是否为主键级字段',
      '字段是否可编辑',
      '字段可否为空（nullable）',
      '提示词-字段说明',
      '抽取提示词（示例）',
      '字段冲突处理规则',
      '扩展配置',
      '字段UID'
    ];

    for (const folder of designModel.folders) {
      for (const group of folder.groups) {
        // 添加字段组行
        rows.push(this._generateGroupCSVRow(folder, group));

        // 添加字段行
        for (const field of group.fields) {
          if (field.isTable && field.children) {
            // table字段，先添加table定义行
            rows.push(this._generateTableCSVRow(folder, group, field));
            // 然后添加子字段行
            for (const childField of field.children) {
              rows.push(this._generateFieldCSVRow(folder, group, field, childField));
            }
          } else {
            rows.push(this._generateFieldCSVRow(folder, group, null, field));
          }
        }
      }
    }

    return { headers, rows };
  }

  /**
   * 生成字段组CSV行
   */
  static _generateGroupCSVRow(folder, group) {
    return [
      folder.name,
      group.name,
      '', '', '', '', '', '', '', '',  // 层级2-10
      group.type || DISPLAY_TYPES.GROUP,  // 展示类型
      '',  // 可选项值
      '',  // 数据类型
      '',  // 数据单位
      group.repeatable ? '可重复' : '不可重复',  // group是否可重复
      '',  // table是否多行
      group.isExtractionUnit ? '是' : '',  // 是否为抽取单位组
      group.sources?.primary?.join(',') || '',  // 主要来源
      group.sources?.secondary?.join(',') || '',  // 次要来源
      group.mergeBinding || '',  // 时间属性字段组绑定
      '', '', '', '', '', '', '', '', '', '', ''
    ];
  }

  /**
   * 生成table字段CSV行
   */
  static _generateTableCSVRow(folder, group, field) {
    const tableRows = field.config?.tableRows || 'multiRow';
    return [
      folder.name,
      group.name,
      field.name,  // 层级2是table名称
      '', '', '', '', '', '', '',  // 层级3-10
      DISPLAY_TYPES.TABLE,  // 展示类型
      '',  // 可选项值
      '',  // 数据类型
      '',  // 数据单位
      '',  // group是否可重复
      tableRows === 'multiRow' ? '多行' : '单行',  // table是否多行
      '', '', '', '', '', '', '', '', '', '', '', '', ''
    ];
  }

  /**
   * 生成字段CSV行
   */
  static _generateFieldCSVRow(folder, group, parentField, field) {
    const level2 = parentField ? parentField.name : '';
    const level3 = parentField ? field.name : '';
    const displayName = parentField ? level3 : field.name;

    // 构建主要来源和次要来源
    let primarySources = '';
    let secondarySources = '';
    if (group.sources) {
      primarySources = group.sources.primary?.join(',') || '';
      secondarySources = group.sources.secondary?.join(',') || '';
    }

    // 构建冲突策略
    let conflictPolicy = '';
    if (field.conflictPolicy) {
      const { policy, compare, warn_on_conflict, ...others } = field.conflictPolicy;
      const parts = [`policy=${policy}`];
      if (compare) parts.push(`compare=${compare}`);
      if (warn_on_conflict !== undefined) parts.push(`warn_on_conflict=${warn_on_conflict}`);
      Object.entries(others).forEach(([k, v]) => {
        if (v !== undefined && v !== null) parts.push(`${k}=${v}`);
      });
      conflictPolicy = parts.join(';');
    }

    // 构建扩展配置
    let extendedConfig = '';
    if (field.config) {
      extendedConfig = JSON.stringify(field.config);
    }

    return [
      folder.name,
      group.name,
      level2,
      level3,
      '', '', '', '', '', '',  // 层级4-10
      field.displayType || '',  // 展示类型
      field.options?.join(',') || '',  // 可选项值
      this._mapDataTypeToCSV(field.dataType, field.displayType),  // 数据类型
      field.unit || '',  // 数据单位
      '',  // group是否可重复（字段不填）
      '',  // table是否多行（字段不填）
      '',  // 是否为抽取单位组（字段不填）
      primarySources,  // 主要来源
      secondarySources,  // 次要来源
      '',  // 时间属性字段组绑定
      field.sensitive ? '是' : '',  // 是否为敏感字段
      field.primary ? '是' : '',  // 是否为主键级字段
      field.editable ? '是' : '否',  // 字段是否可编辑
      field.nullable ? '是' : '否',  // 字段可否为空
      field.description || '',  // 提示词-字段说明
      field.extractionPrompt || '',  // 抽取提示词
      conflictPolicy,  // 字段冲突处理规则
      extendedConfig,  // 扩展配置
      field.uid || ''  // 字段UID
    ];
  }

  /**
   * 映射数据类型到CSV格式
   */
  static _mapDataTypeToCSV(dataType, displayType) {
    if (displayType === DISPLAY_TYPES.NUMBER) return '数字';
    if (displayType === DISPLAY_TYPES.DATE) return '日期';
    if (displayType === DISPLAY_TYPES.FILE) return '文件';
    return '文本';
  }
}

export default SchemaGenerator;
