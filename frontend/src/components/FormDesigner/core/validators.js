/**
 * Schema验证器
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { DISPLAY_TYPES, CONFLICT_POLICIES, COMPARE_TYPES } from './constants';

/**
 * Schema验证器类
 */
export class SchemaValidator {
  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(this.ajv);
  }

  /**
   * 兼容/归一化：把“根级直接是 group”的 schema 包装成 folder->group 结构，
   * 同时补齐 folder 缺失的 type=object。
   *
   * 设计器内部约定：
   * - schema.properties.<folderName> 必须是 object
   * - schema.properties.<folderName>.properties.<groupName> 必须是 object 或 array(items.object)
   */
  normalizeSchemaForDesigner(schema) {
    try {
      if (!schema || typeof schema !== 'object') return schema;
      // 深拷贝，避免在解析/校验阶段意外修改外部引用
      const s = JSON.parse(JSON.stringify(schema));
      if (!s.properties || typeof s.properties !== 'object') return s;

      for (const [rootKey, rootNode] of Object.entries(s.properties)) {
        if (!rootNode || typeof rootNode !== 'object') continue;

        const hasProps = !!(rootNode.properties && typeof rootNode.properties === 'object');
        const isFolderShape = rootNode.type === 'object' || (!rootNode.type && hasProps);

        if (isFolderShape) {
          // 允许缺失 type 的 folder（历史数据），自动补齐为 object
          rootNode.type = 'object';
          rootNode.properties = rootNode.properties || {};
          if (rootNode.unevaluatedProperties === undefined) {
            rootNode.unevaluatedProperties = false;
          }
          continue;
        }

        // 根级节点如果更像“group”（object/array/items/properties），则自动包一层 folder
        const looksLikeGroup =
          rootNode.type === 'array' ||
          rootNode.type === 'object' ||
          hasProps ||
          (rootNode.items && typeof rootNode.items === 'object');

        if (looksLikeGroup) {
          s.properties[rootKey] = {
            type: 'object',
            unevaluatedProperties: false,
            properties: {
              [rootKey]: rootNode
            }
          };
        }
      }

      return s;
    } catch (e) {
      // 归一化失败不应阻塞主流程，交给后续 validator 报更明确的错误
      return schema;
    }
  }

  /**
   * 验证JSON Schema格式
   * @param {Object} schema - 待验证的Schema
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateSchemaFormat(schema) {
    try {
      // 先做一次兼容归一化（不改变原 schema 引用）
      schema = this.normalizeSchemaForDesigner(schema);

      // 验证基本结构
      if (!schema.$schema) {
        return {
          valid: false,
          errors: [{ message: '缺少$schema声明', path: '$' }]
        };
      }

      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return {
          valid: false,
          errors: [{ message: 'Schema必须包含至少一个文件夹', path: 'properties' }]
        };
      }

      // 验证文件夹结构
      const folderErrors = this._validateFolders(schema.properties);
      if (folderErrors.length > 0) {
        return { valid: false, errors: folderErrors };
      }

      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [{ message: `Schema解析失败: ${error.message}`, path: 'root' }]
      };
    }
  }

  /**
   * 验证文件夹结构
   */
  _validateFolders(properties) {
    const errors = [];

    for (const [folderName, folderSchema] of Object.entries(properties)) {
      // 验证文件夹是object类型
      // 兼容：允许缺失 type 但存在 properties（按 object 处理）
      if (folderSchema.type !== 'object' && !(folderSchema.type === undefined && folderSchema.properties)) {
        errors.push({
          message: `文件夹"${folderName}"必须是object类型`,
          path: `properties.${folderName}.type`
        });
        continue;
      }

      // 允许空文件夹（用户可能先建目录后填表单）
      if (!folderSchema.properties) continue;

      // 验证字段组
      const groupErrors = this._validateGroups(folderSchema.properties, folderName);
      errors.push(...groupErrors);
    }

    return errors;
  }

  /**
   * 验证字段组
   */
  _validateGroups(properties, folderName) {
    const errors = [];

    for (const [groupName, groupSchema] of Object.entries(properties)) {
      // 验证字段组类型
      if (groupSchema.type === 'array') {
        if (!groupSchema.items) {
          errors.push({
            message: `字段组"${folderName}.${groupName}"是array类型但缺少items定义`,
            path: `properties.${folderName}.properties.${groupName}.items`
          });
          continue;
        }
        if (groupSchema.items.type !== 'object') {
          errors.push({
            message: `字段组"${folderName}.${groupName}"的items必须是object类型`,
            path: `properties.${folderName}.properties.${groupName}.items.type`
          });
        }
      } else if (groupSchema.type !== 'object') {
        errors.push({
          message: `字段组"${folderName}.${groupName}"必须是object或array类型`,
          path: `properties.${folderName}.properties.${groupName}.type`
        });
      }

      // 验证x-sources（抽取单元必须有x-sources）
      const target = groupSchema.type === 'array' ? groupSchema.items : groupSchema;
      if (target['x-sources'] && !Array.isArray(target['x-sources'].primary)) {
        errors.push({
          message: `字段组"${folderName}.${groupName}"的x-sources.primary必须是数组`,
          path: `properties.${folderName}.properties.${groupName}['x-sources'].primary`
        });
      }

      // 验证字段
      if (target.properties) {
        const fieldErrors = this._validateFields(target.properties, folderName, groupName);
        errors.push(...fieldErrors);
      }
    }

    return errors;
  }

  /**
   * 验证字段
   */
  _validateFields(properties, folderName, groupName) {
    const errors = [];

    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      // 跳过嵌套的object/array（这些是子表格）
      if (fieldSchema.type === 'object' ||
          (fieldSchema.type === 'array' && fieldSchema.items?.type === 'object')) {
        continue;
      }

      // 验证字段类型
      const validTypes = ['string', 'number', 'boolean', 'array'];
      if (!validTypes.includes(fieldSchema.type)) {
        errors.push({
          message: `字段"${folderName}.${groupName}.${fieldName}"的类型无效`,
          path: `properties.${folderName}.properties.${groupName}.properties.${fieldName}.type`
        });
      }

      // 验证x-field-uid格式
      if (fieldSchema['x-field-uid']) {
        const uid = fieldSchema['x-field-uid'];
        if (!/^f_[a-z0-9]{8}$/i.test(uid)) {
          errors.push({
            message: `字段"${fieldName}"的x-field-uid格式错误，应为f_xxxxxxxx格式`,
            path: `properties.${folderName}.properties.${groupName}.properties.${fieldName}['x-field-uid']`
          });
        }
      }

      // 验证x-display
      if (fieldSchema['x-display']) {
        const displayType = fieldSchema['x-display'];
        if (!Object.values(DISPLAY_TYPES).includes(displayType)) {
          errors.push({
            message: `字段"${fieldName}"的x-display值无效: ${displayType}`,
            path: `properties.${folderName}.properties.${groupName}.properties.${fieldName}['x-display']`
          });
        }
      }

      // 验证x-conflict-policy
      if (fieldSchema['x-conflict-policy']) {
        const policy = fieldSchema['x-conflict-policy'];
        if (!Object.values(CONFLICT_POLICIES).includes(policy.policy)) {
          errors.push({
            message: `字段"${fieldName}"的冲突策略无效: ${policy.policy}`,
            path: `properties.${folderName}.properties.${groupName}.properties.${fieldName}['x-conflict-policy'].policy`
          });
        }
      }
    }

    return errors;
  }

  /**
   * 验证设计器数据模型
   * @param {Object} designModel - 设计器数据模型
   * @returns {Object} { valid: boolean, errors: Array }
   */
  validateDesignModel(designModel) {
    const errors = [];

    // 验证基本结构
    if (!designModel.folders || !Array.isArray(designModel.folders)) {
      return {
        valid: false,
        errors: [{ message: '设计模型必须包含folders数组', field: 'folders' }]
      };
    }

    if (designModel.folders.length === 0) {
      return {
        valid: false,
        errors: [{ message: '至少需要一个文件夹', field: 'folders' }]
      };
    }

    // 验证文件夹
    for (const folder of designModel.folders) {
      const folderErrors = this._validateFolderModel(folder);
      errors.push(...folderErrors);
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] };
  }

  /**
   * 验证文件夹模型
   */
  _validateFolderModel(folder) {
    const errors = [];

    if (!folder.id) {
      errors.push({ message: '文件夹缺少id', field: 'folder.id' });
    }
    if (!folder.name || folder.name.trim() === '') {
      errors.push({ message: '文件夹名称不能为空', field: 'folder.name' });
    }
    if (!folder.groups || !Array.isArray(folder.groups)) {
      errors.push({ message: '文件夹必须包含groups数组', field: 'folder.groups' });
    }

    // 验证字段组
    if (folder.groups) {
      for (const group of folder.groups) {
        const groupErrors = this._validateGroupModel(group, folder.name);
        errors.push(...groupErrors);
      }
    }

    return errors;
  }

  /**
   * 验证字段组模型
   */
  _validateGroupModel(group, folderName) {
    const errors = [];

    if (!group.id) {
      errors.push({ message: `字段组缺少id`, field: 'group.id' });
    }
    if (!group.name || group.name.trim() === '') {
      errors.push({ message: '字段组名称不能为空', field: 'group.name' });
    }
    if (!group.fields || !Array.isArray(group.fields)) {
      errors.push({ message: `字段组"${group.name}"必须包含fields数组`, field: 'group.fields' });
    }

    // 验证字段
    if (group.fields) {
      for (const field of group.fields) {
        const fieldErrors = this._validateFieldModel(field, group.name, folderName);
        errors.push(...fieldErrors);
      }
    }

    return errors;
  }

  /**
   * 验证字段模型
   */
  _validateFieldModel(field, groupName, folderName) {
    const errors = [];

    if (!field.id) {
      errors.push({ message: '字段缺少id', field: 'field.id' });
    }
    if (!field.name || field.name.trim() === '') {
      errors.push({ message: '字段名称不能为空', field: 'field.name' });
    }
    if (!field.displayType) {
      errors.push({ message: `字段"${field.name}"缺少displayType`, field: 'field.displayType' });
    } else if (!Object.values(DISPLAY_TYPES).includes(field.displayType)) {
      errors.push({
        message: `字段"${field.name}"的displayType无效: ${field.displayType}`,
        field: 'field.displayType'
      });
    }

    // 验证选项类字段必须有options
    if (['radio', 'checkbox', 'select', 'multiselect'].includes(field.displayType)) {
      if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
        errors.push({
          message: `字段"${field.name}"是选项类型但缺少options配置`,
          field: 'field.options'
        });
      }
    }

    return errors;
  }

  /**
   * 验证字段值
   * @param {any} value - 字段值
   * @param {Object} fieldSchema - 字段Schema
   * @returns {Object} { valid: boolean, error: string }
   */
  validateFieldValue(value, fieldSchema) {
    // 空值处理
    if (value === null || value === undefined || value === '') {
      // 如果字段必填，则验证失败
      if (fieldSchema.required && !fieldSchema.nullable) {
        return { valid: false, error: '该字段为必填项' };
      }
      return { valid: true };
    }

    // 类型验证
    switch (fieldSchema.dataType) {
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: '请输入有效的数字' };
        }
        // 范围验证
        if (fieldSchema.validation) {
          if (fieldSchema.validation.min !== undefined && value < fieldSchema.validation.min) {
            return { valid: false, error: `最小值为${fieldSchema.validation.min}` };
          }
          if (fieldSchema.validation.max !== undefined && value > fieldSchema.validation.max) {
            return { valid: false, error: `最大值为${fieldSchema.validation.max}` };
          }
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: '请输入有效的文本' };
        }
        // 长度验证
        if (fieldSchema.validation) {
          if (fieldSchema.validation.minLength !== undefined &&
              value.length < fieldSchema.validation.minLength) {
            return { valid: false, error: `最小长度为${fieldSchema.validation.minLength}` };
          }
          if (fieldSchema.validation.maxLength !== undefined &&
              value.length > fieldSchema.validation.maxLength) {
            return { valid: false, error: `最大长度为${fieldSchema.validation.maxLength}` };
          }
          // 正则验证
          if (fieldSchema.validation.pattern) {
            const regex = new RegExp(fieldSchema.validation.pattern);
            if (!regex.test(value)) {
              return { valid: false, error: '格式不正确' };
            }
          }
        }
        break;

      case 'array':
        if (!Array.isArray(value)) {
          return { valid: false, error: '请选择有效的选项' };
        }
        if (fieldSchema.required && value.length === 0) {
          return { valid: false, error: '请至少选择一项' };
        }
        break;
    }

    // 选项验证
    if (fieldSchema.options && fieldSchema.options.length > 0) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (!fieldSchema.options.includes(item)) {
            return { valid: false, error: `选项"${item}"不在可选值范围内` };
          }
        }
      } else if (!fieldSchema.options.includes(value)) {
        return { valid: false, error: `选项"${value}"不在可选值范围内` };
      }
    }

    return { valid: true };
  }
}

// 导出单例实例
export const schemaValidator = new SchemaValidator();

// 便捷导出：给外部（useSchemaParser）调用的 schema 归一化函数
export const normalizeSchemaForDesigner = (schema) => schemaValidator.normalizeSchemaForDesigner(schema);
