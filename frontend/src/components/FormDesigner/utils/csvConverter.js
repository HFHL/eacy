/**
 * CSV转换器
 * 提供CSV导入导出功能
 */

import Papa from 'papaparse';
import { CSV_COLUMNS } from '../core/constants';
import { getFieldTypeLabel } from './schemaHelpers';

/**
 * CSV转换器类
 */
export class CSVConverter {
  /**
   * 将设计模型转换为CSV格式
   * @param {Object} designModel - 设计模型数据
   * @returns {Array} CSV行数据数组
   */
  static designModelToCSV(designModel) {
    const rows = [];

    // 添加表头
    rows.push(Object.values(CSV_COLUMNS));

    // 遍历所有文件夹和组
    designModel.folders.forEach(folder => {
      (folder.groups || []).forEach(group => {
        (group.fields || []).forEach(field => {
          rows.push(this._fieldToCSVRow(folder, group, field));
        });
      });
    });

    return rows;
  }

  /**
   * 将字段转换为CSV行
   */
  static _fieldToCSVRow(folder, group, field) {
    return [
      folder.name || '',
      group.name || '',
      field.name || '',
      getFieldTypeLabel(field.displayType) || '',
      field.dataType || '',
      field.unit || '',
      field.required ? '是' : '否',
      field.nullable !== false ? '是' : '否',
      field.primary ? '是' : '否',
      field.sensitive ? '是' : '否',
      field.editable === false ? '否' : '是',
      field.minimum || '',
      field.maximum || '',
      field.pattern || '',
      field.format || '',
      field.options?.join(', ') || '',
      field.conflictPolicy || '',
      field.compareType || '',
      field.mergeBindings?.join(', ') || '',
      field.dataSources?.join(', ') || '',
      field.enumRef || '',
      field.description || '',
      field.extractionPrompt || '',
      field.defaultValue || '',
      field.xProperties ? JSON.stringify(field.xProperties) : '',
      field.uid || '',
      field.version || '',
      group.order || '',
      field.order || ''
    ];
  }

  /**
   * 将CSV数据转换为设计模型
   * @param {Array} csvData - CSV数据数组（包含表头）
   * @returns {Object} 设计模型数据
   */
  static csvToDesignModel(csvData) {
    if (!csvData || csvData.length < 2) {
      throw new Error('CSV数据为空或格式不正确');
    }

    const headers = csvData[0];
    const dataRows = csvData.slice(1);

    // 验证表头
    this._validateCSVHeaders(headers);

    const designModel = {
      meta: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'generated-from-csv',
        title: '从CSV导入的Schema',
        version: '1.0.0',
        projectId: 'csv-import',
        createdAt: new Date().toISOString()
      },
      folders: {},
      enums: {}
    };

    // 按文件夹和组组织字段
    const folderMap = new Map();
    let currentContainer = null; // 用于追踪当前的 table 或 group 字段

    dataRows.forEach(row => {
      const fieldData = this._csvRowToField(headers, row);

      const folderKey = fieldData.folderName;
      const groupKey = fieldData.groupName;

      // 如果只有层级3或更深，则说明它是当前容器的子字段
      const hasLevel2 = !!fieldData.level2Name;
      const hasLevel3 = !!fieldData.level3Name;
      let fieldName = fieldData.field.name || '';

      if (!folderMap.has(folderKey)) {
        folderMap.set(folderKey, {
          id: `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: folderKey,
          groups: []
        });
      }

      const folder = folderMap.get(folderKey);
      let group = folder.groups.find(g => g.name === groupKey);

      if (!group) {
        group = {
          id: `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: groupKey,
          order: parseInt(fieldData.groupOrder) || 0,
          fields: []
        };
        // 赋予 group 整体抽取单元配置，只取包含该设置的行
        if (fieldData.raw.groupRepeatable === '是' || fieldData.raw.groupRepeatable === '可重复') {
           // CSV的 "group是否可重复" 其实是说这个 group 级表单是否可多行录入 
           // 实际上是在 meta 层面，这里暂不处理（在 schemaHelpers 里可能映射）
        }
        folder.groups.push(group);
      }

      // 如果这是一行全局定义行（只有层级1，没有层级2或更深，或者字段名为空且这是声明），忽略或仅提取属性
      if (!hasLevel2 && !hasLevel3 && (!fieldName || fieldName === groupKey)) {
        if (fieldData.raw.isExtractionUnit === '是') group.isExtractionUnit = true;
        if (fieldData.raw.primarySources) {
          group.sources = group.sources || {};
          group.sources.primary = this._parseArray(fieldData.raw.primarySources);
        }
        if (fieldData.raw.groupRepeatable === '是' || fieldData.raw.groupRepeatable === '可重复') {
          group.repeatable = true;
        }
        return;
      }

      const f = fieldData.field;

      // 判断它是不是一个 table/group 字段定义（作为子目录）
      if (f.displayType === 'table' || f.displayType === 'group') {
        f.name = fieldData.level2Name;
        f.displayName = fieldData.level2Name;
        f.children = [];
        if (f.displayType === 'table') {
          f.isTable = true;
          f.multiRow = (fieldData.raw.tableMultiRow === '多行');
          f.config = { tableRows: f.multiRow ? 'multiRow' : 'singleRow' };
        } else {
          f.repeatable = (fieldData.raw.groupRepeatable === '可重复' || fieldData.raw.groupRepeatable === '是');
        }
        group.fields.push(f);
        currentContainer = f;
      } 
      // 检查是否属于当前活跃容器的子字段
      else if (currentContainer && hasLevel3) {
        f.name = fieldData.level3Name;
        f.displayName = fieldData.level3Name;
        currentContainer.children.push(f);
      } 
      // 否则就是一个独立的简单字段
      else if (hasLevel2) {
        f.name = fieldData.level2Name;
        f.displayName = fieldData.level2Name;
        group.fields.push(f);
        currentContainer = null;
      }
    });

    // 转换为数组格式
    designModel.folders = Array.from(folderMap.values());

    return designModel;
  }

  /**
   * 验证CSV表头
   */
  static _validateCSVHeaders(headers) {
    const requiredHeaders = [
      CSV_COLUMNS.FOLDER,
      CSV_COLUMNS.LEVEL1
    ];

    const missingHeaders = requiredHeaders.filter(
      required => !headers.includes(required)
    );

    if (missingHeaders.length > 0) {
      throw new Error(`CSV缺少必需的列: ${missingHeaders.join(', ')}`);
    }
  }

  /**
   * 将CSV行转换为字段数据
   */
  static _csvRowToField(headers, row) {
    const getValue = (index) => row[index] || '';

    const folderName = getValue(headers.indexOf(CSV_COLUMNS.FOLDER));
    const groupName = getValue(headers.indexOf(CSV_COLUMNS.LEVEL1));
    
    // 提取层级2和层级3的名称，用于判定层级嵌套
    let level2Name = '';
    let level3Name = '';
    if (CSV_COLUMNS.LEVEL2_10 && Array.isArray(CSV_COLUMNS.LEVEL2_10)) {
      level2Name = getValue(headers.indexOf(CSV_COLUMNS.LEVEL2_10[0]));
      level3Name = getValue(headers.indexOf(CSV_COLUMNS.LEVEL2_10[1]));
    }

    const field = {
      id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: getValue(headers.indexOf(CSV_COLUMNS.FIELD_NAME)),
      displayType: this._parseDisplayType(getValue(headers.indexOf(CSV_COLUMNS.DISPLAY_TYPE))),
      dataType: getValue(headers.indexOf(CSV_COLUMNS.DATA_TYPE)) || 'string',
      unit: getValue(headers.indexOf(CSV_COLUMNS.UNIT)),
      required: getValue(headers.indexOf(CSV_COLUMNS.REQUIRED)) === '是',
      nullable: getValue(headers.indexOf(CSV_COLUMNS.NULLABLE)) !== '否',
      primary: getValue(headers.indexOf(CSV_COLUMNS.PRIMARY)) === '是',
      sensitive: getValue(headers.indexOf(CSV_COLUMNS.SENSITIVE)) === '是',
      editable: getValue(headers.indexOf(CSV_COLUMNS.EDITABLE)) !== '否',
      minimum: this._parseNumber(getValue(headers.indexOf(CSV_COLUMNS.MINIMUM))),
      maximum: this._parseNumber(getValue(headers.indexOf(CSV_COLUMNS.MAXIMUM))),
      pattern: getValue(headers.indexOf(CSV_COLUMNS.PATTERN)),
      format: getValue(headers.indexOf(CSV_COLUMNS.FORMAT)),
      options: this._parseOptions(getValue(headers.indexOf(CSV_COLUMNS.OPTIONS))),
      conflictPolicy: getValue(headers.indexOf(CSV_COLUMNS.CONFLICT_POLICY)),
      compareType: getValue(headers.indexOf(CSV_COLUMNS.COMPARE_TYPE)),
      mergeBindings: this._parseArray(getValue(headers.indexOf(CSV_COLUMNS.MERGE_BINDING))),
      dataSources: this._parseArray(getValue(headers.indexOf(CSV_COLUMNS.DATA_SOURCES))),
      enumRef: getValue(headers.indexOf(CSV_COLUMNS.ENUM_REF)),
      description: getValue(headers.indexOf(CSV_COLUMNS.DESCRIPTION)),
      extractionPrompt: getValue(headers.indexOf(CSV_COLUMNS.EXTRACTION_PROMPT)),
      defaultValue: getValue(headers.indexOf(CSV_COLUMNS.DEFAULT_VALUE)),
      order: parseInt(getValue(headers.indexOf(CSV_COLUMNS.FIELD_ORDER))) || 0
    };

    // 处理扩展属性
    const xPropertiesStr = getValue(headers.indexOf(CSV_COLUMNS.X_PROPERTIES));
    if (xPropertiesStr) {
      try {
        field.xProperties = JSON.parse(xPropertiesStr);
      } catch (e) {
        console.warn('无法解析扩展属性:', xPropertiesStr);
      }
    }

    // 处理UID
    const uidValue = getValue(headers.indexOf(CSV_COLUMNS.FIELD_UID));
    if (uidValue) {
      field.uid = uidValue;
    }

    // 处理版本
    const versionValue = getValue(headers.indexOf(CSV_COLUMNS.VERSION));
    if (versionValue) {
      field.version = versionValue;
    }

    return {
      folderName,
      groupName,
      level2Name,
      level3Name,
      groupOrder: parseInt(getValue(headers.indexOf(CSV_COLUMNS.GROUP_ORDER))) || 0,
      field,
      raw: {
        isExtractionUnit: getValue(headers.indexOf(CSV_COLUMNS.IS_EXTRACTION_UNIT)),
        primarySources: getValue(headers.indexOf(CSV_COLUMNS.PRIMARY_SOURCES)),
        groupRepeatable: getValue(headers.indexOf(CSV_COLUMNS.GROUP_REPEATABLE)),
        tableMultiRow: getValue(headers.indexOf(CSV_COLUMNS.TABLE_MULTI_ROW))
      }
    };
  }

  /**
   * 解析展示类型
   */
  static _parseDisplayType(label) {
    if (!label) return 'text';
    const normalizedLabel = label.trim().toLowerCase();
    
    // 如果已经是英文类型，直接返回
    const validTypes = ['text', 'textarea', 'number', 'date', 'radio', 'checkbox', 'select', 'multiselect', 'file', 'group', 'table', 'matrix_radio', 'matrix_checkbox', 'slider', 'paragraph', 'divider', 'cascader', 'randomization'];
    if (validTypes.includes(normalizedLabel)) {
      return normalizedLabel;
    }

    const typeMap = {
      '文本': 'text',
      '多行文本': 'textarea',
      '数字': 'number',
      '日期': 'date',
      '单选': 'radio',
      '多选': 'checkbox',
      '下拉单选': 'select',
      '下拉多选': 'multiselect',
      '文件': 'file',
      '分组': 'group',
      '表格': 'table'
    };
    return typeMap[label.trim()] || 'text';
  }

  /**
   * 解析选项
   */
  static _parseOptions(optionsStr) {
    if (!optionsStr) return undefined;
    return optionsStr.split(',').map(s => s.trim()).filter(s => s);
  }

  /**
   * 解析数组（用于dataSources、mergeBindings等）
   */
  static _parseArray(arrayStr) {
    if (!arrayStr) return undefined;
    return arrayStr.split(',').map(s => s.trim()).filter(s => s);
  }

  /**
   * 解析合并绑定（已废弃，保留用于兼容性）
   */
  static _parseMergeBinding(bindingStr) {
    if (!bindingStr) return undefined;
    const sourceFields = bindingStr.split(',').map(s => s.trim()).filter(s => s);
    if (sourceFields.length === 0) return undefined;
    return { sourceFields };
  }

  /**
   * 解析数字
   */
  static _parseNumber(value) {
    if (!value) return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * 导出CSV文件
   */
  static downloadCSV(csvData, filename = 'schema.csv') {
    const csvString = Papa.unparse(csvData);
    const blob = new Blob(['\ufeff' + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * 导入CSV文件
   */
  static importCSV(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        encoding: 'UTF-8',
        complete: (results) => {
          try {
            const designModel = this.csvToDesignModel(results.data);
            resolve(designModel);
          } catch (error) {
            reject(error);
          }
        },
        error: (error) => {
          reject(error);
        }
      });
    });
  }

  /**
   * 验证CSV数据
   */
  static validateCSV(csvData) {
    const errors = [];
    const warnings = [];

    if (!csvData || csvData.length < 2) {
      errors.push('CSV数据为空');
      return { valid: false, errors, warnings };
    }

    const headers = csvData[0];

    // 检查必需列
    const requiredColumns = [
      CSV_COLUMNS.FOLDER,
      CSV_COLUMNS.LEVEL1
    ];

    requiredColumns.forEach(col => {
      if (!headers.includes(col)) {
        errors.push(`缺少必需列: ${col}`);
      }
    });

    // 检查数据行
    const dataRows = csvData.slice(1);
    dataRows.forEach((row, index) => {
      const rowIndex = index + 2; // +2 因为索引从1开始，且第1行是表头

      const folderName = row[headers.indexOf(CSV_COLUMNS.FOLDER)];
      const groupName = row[headers.indexOf(CSV_COLUMNS.LEVEL1)];

      if (!folderName) {
        errors.push(`第${rowIndex}行: 文件夹名称为空`);
      }
      if (!groupName) {
        errors.push(`第${rowIndex}行: 表单名称为空`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export default CSVConverter;
