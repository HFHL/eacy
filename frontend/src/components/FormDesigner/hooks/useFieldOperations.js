/**
 * useFieldOperations Hook
 * 用于字段操作的高级功能
 */

import { useCallback } from 'react';
import { DISPLAY_TYPES } from '../core/constants';

/**
 * 字段操作Hook
 * @param {Function} updateField - 更新字段的函数
 * @returns {Object} Hook返回值
 */
export const useFieldOperations = (updateField) => {
  /**
   * 批量更新字段属性
   */
  const batchUpdateFields = useCallback((fields, updates) => {
    const results = [];
    for (const field of fields) {
      const result = updateField(
        field.folderId,
        field.groupId,
        field.fieldId,
        updates
      );
      results.push(result);
    }
    return results;
  }, [updateField]);

  /**
   * 批量设置必填
   */
  const batchSetRequired = useCallback((fields, required = true) => {
    return batchUpdateFields(fields, {
      required,
      nullable: !required
    });
  }, [batchUpdateFields]);

  /**
   * 批量设置可编辑
   */
  const batchSetEditable = useCallback((fields, editable = true) => {
    return batchUpdateFields(fields, { editable });
  }, [batchUpdateFields]);

  /**
   * 批量设置敏感
   */
  const batchSetSensitive = useCallback((fields, sensitive = true) => {
    return batchUpdateFields(fields, { sensitive });
  }, [batchUpdateFields]);

  /**
   * 批量更改展示类型
   */
  const batchChangeDisplayType = useCallback((fields, displayType) => {
    // 根据展示类型自动推断数据类型
    const dataType = inferDataType(displayType);
    return batchUpdateFields(fields, { displayType, dataType });
  }, [batchUpdateFields]);

  /**
   * 批量更新AI提示词
   */
  const batchUpdateExtractionPrompt = useCallback((
    fields,
    promptTemplate
  ) => {
    return batchUpdateFields(fields, {
      extractionPrompt: promptTemplate
    });
  }, [batchUpdateFields]);

  /**
   * 验证字段配置
   */
  const validateFieldConfig = useCallback((field) => {
    const errors = [];

    // 基础验证
    if (!field.name || field.name.trim() === '') {
      errors.push('字段名称不能为空');
    }

    if (!field.displayType) {
      errors.push('请选择展示类型');
    }

    // 选项类型验证
    if ([DISPLAY_TYPES.RADIO, DISPLAY_TYPES.CHECKBOX,
         DISPLAY_TYPES.SELECT, DISPLAY_TYPES.MULTISELECT].includes(field.displayType)) {
      if (!field.options || !Array.isArray(field.options) || field.options.length === 0) {
        errors.push('选项类型字段必须配置选项值');
      }
    }

    // 数字类型验证
    if (field.displayType === DISPLAY_TYPES.NUMBER) {
      if (field.validation) {
        if (field.validation.min !== undefined &&
            field.validation.max !== undefined &&
            field.validation.min >= field.validation.max) {
          errors.push('最小值必须小于最大值');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }, []);

  /**
   * 优化字段配置
   */
  const optimizeFieldConfig = useCallback((field) => {
    const optimizations = [];

    // 根据字段名称推断属性
    const name = field.name.toLowerCase();

    // 推断敏感字段
    if (name.includes('姓名') || name.includes('身份证') ||
        name.includes('电话') || name.includes('地址')) {
      if (!field.sensitive) {
        optimizations.push({ key: 'sensitive', value: true, reason: '根据字段名推断' });
      }
    }

    // 推断主键字段
    if (name.includes('病案号') || name.includes('住院号') ||
        name.includes('id') || name.includes('编号')) {
      if (!field.primary) {
        optimizations.push({ key: 'primary', value: true, reason: '根据字段名推断' });
      }
    }

    // 推断展示类型
    if (name.includes('日期') || name.includes('时间')) {
      if (field.displayType !== DISPLAY_TYPES.DATE) {
        optimizations.push({
          key: 'displayType',
          value: DISPLAY_TYPES.DATE,
          reason: '根据字段名推断'
        });
      }
    } else if (name.includes('年龄') || name.includes('数量') ||
               name.includes('金额') || name.includes('费用')) {
      if (field.displayType !== DISPLAY_TYPES.NUMBER) {
        optimizations.push({
          key: 'displayType',
          value: DISPLAY_TYPES.NUMBER,
          reason: '根据字段名推断'
        });
      }
    }

    return optimizations;
  }, []);

  /**
   * 智能生成字段配置
   */
  const generateFieldConfig = useCallback((fieldName, fieldType) => {
    const config = {
      name: fieldName,
      displayName: fieldName,
      displayType: fieldType,
      dataType: inferDataType(fieldType),
      options: null,
      unit: null,
      nullable: true,
      sensitive: false,
      primary: false,
      editable: true,
      required: false,
      description: '',
      extractionPrompt: '',
      conflictPolicy: null
    };

    // 根据字段类型和名称自动配置
    const name = fieldName.toLowerCase();

    // 设置默认单位
    if (name.includes('年龄')) {
      config.unit = '岁';
    } else if (name.includes('天数') || name.includes('住院天数')) {
      config.unit = '天';
    } else if (name.includes('金额') || name.includes('费用')) {
      config.unit = '元';
    }

    // 设置默认选项
    if (fieldType === DISPLAY_TYPES.RADIO || fieldType === DISPLAY_TYPES.SELECT) {
      if (name.includes('性别')) {
        config.options = ['男', '女', '不详'];
        config.description = '患者性别';
      } else if (name.includes('是否') || name.includes('有无')) {
        config.options = ['是', '否'];
        config.description = `是否${fieldName.replace('是否', '').replace('有无', '')}`;
      }
    }

    // 生成默认抽取提示词
    config.extractionPrompt = generateDefaultPrompt(fieldName, fieldType);

    return config;
  }, []);

  /**
   * 复制字段到另一个组
   */
  const copyFieldToGroup = useCallback((
    sourceField,
    targetFolderId,
    targetGroupId
  ) => {
    const copiedField = {
      ...sourceField,
      id: undefined, // 让系统生成新ID
      uid: null, // 复制时生成新UID
      name: `${sourceField.name}_副本`,
      displayName: `${sourceField.displayName}_副本`
    };

    return updateField(targetFolderId, targetGroupId, null, copiedField);
  }, [updateField]);

  /**
   * 移动字段到另一个组
   */
  const moveFieldToGroup = useCallback((
    sourceFolderId,
    sourceGroupId,
    sourceFieldId,
    targetFolderId,
    targetGroupId,
    targetIndex
  ) => {
    // 这需要在useDesignData中实现完整的移动逻辑
    // 这里只是提供接口
    console.warn('moveFieldToGroup需要在useDesignData中实现');
    return null;
  }, []);

  return {
    // 批量操作
    batchUpdateFields,
    batchSetRequired,
    batchSetEditable,
    batchSetSensitive,
    batchChangeDisplayType,
    batchUpdateExtractionPrompt,

    // 验证和优化
    validateFieldConfig,
    optimizeFieldConfig,
    generateFieldConfig,

    // 跨组操作
    copyFieldToGroup,
    moveFieldToGroup
  };
};

/**
 * 推断数据类型
 */
function inferDataType(displayType) {
  const typeMap = {
    [DISPLAY_TYPES.NUMBER]: 'number',
    [DISPLAY_TYPES.CHECKBOX]: 'array',
    [DISPLAY_TYPES.MULTISELECT]: 'array',
    [DISPLAY_TYPES.DATE]: 'string'
  };
  return typeMap[displayType] || 'string';
}

/**
 * 生成默认抽取提示词
 */
function generateDefaultPrompt(fieldName, fieldType) {
  const prompts = {
    [DISPLAY_TYPES.TEXT]: `请从医疗文档中提取${fieldName}信息`,
    [DISPLAY_TYPES.NUMBER]: `请从医疗文档中提取${fieldName}的数值，仅输出数字`,
    [DISPLAY_TYPES.DATE]: `请从医疗文档中提取${fieldName}，格式为YYYY-MM-DD`,
    [DISPLAY_TYPES.RADIO]: `请从医疗文档中判断${fieldName}，必须从选项中选择`,
    [DISPLAY_TYPES.CHECKBOX]: `请从医疗文档中提取${fieldName}，可选择多个选项`,
    [DISPLAY_TYPES.TEXTAREA]: `请从医疗文档中提取${fieldName}的详细描述`
  };

  return prompts[fieldType] || `请从医疗文档中提取${fieldName}`;
}

export default useFieldOperations;
