/**
 * Schema辅助函数
 */

import { DISPLAY_TYPES } from '../core/constants';

/**
 * 获取字段类型的标签
 */
export function getFieldTypeLabel(displayType) {
  const labels = {
    [DISPLAY_TYPES.TEXT]: '文本',
    [DISPLAY_TYPES.TEXTAREA]: '多行文本',
    [DISPLAY_TYPES.NUMBER]: '数字',
    [DISPLAY_TYPES.DATE]: '日期',
    [DISPLAY_TYPES.RADIO]: '单选',
    [DISPLAY_TYPES.CHECKBOX]: '多选',
    [DISPLAY_TYPES.SELECT]: '下拉单选',
    [DISPLAY_TYPES.MULTISELECT]: '下拉多选',
    [DISPLAY_TYPES.FILE]: '文件',
    [DISPLAY_TYPES.GROUP]: '分组',
    [DISPLAY_TYPES.TABLE]: '表格',
    [DISPLAY_TYPES.MULTI_TEXT]: '多项填空',
    [DISPLAY_TYPES.SLIDER]: '滑块',
    [DISPLAY_TYPES.CASCADER]: '级联选择',
    [DISPLAY_TYPES.MATRIX_RADIO]: '矩阵单选',
    [DISPLAY_TYPES.MATRIX_CHECKBOX]: '矩阵多选',
    [DISPLAY_TYPES.PARAGRAPH]: '段落说明',
    [DISPLAY_TYPES.DIVIDER]: '分割线',
    [DISPLAY_TYPES.RANDOMIZATION]: '随机化分组'
  };
  return labels[displayType] || displayType;
}

/**
 * 获取字段类型的图标
 */
export function getFieldTypeIcon(displayType) {
  const icons = {
    [DISPLAY_TYPES.TEXT]: 'FontSizeOutlined',
    [DISPLAY_TYPES.TEXTAREA]: 'FileTextOutlined',
    [DISPLAY_TYPES.NUMBER]: 'NumberOutlined',
    [DISPLAY_TYPES.DATE]: 'CalendarOutlined',
    [DISPLAY_TYPES.RADIO]: 'CheckCircleOutlined',
    [DISPLAY_TYPES.CHECKBOX]: 'CheckSquareOutlined',
    [DISPLAY_TYPES.SELECT]: 'DownOutlined',
    [DISPLAY_TYPES.MULTISELECT]: 'CheckSquareOutlined',
    [DISPLAY_TYPES.FILE]: 'UploadOutlined',
    [DISPLAY_TYPES.GROUP]: 'FolderOutlined',
    [DISPLAY_TYPES.TABLE]: 'TableOutlined',
    [DISPLAY_TYPES.MULTI_TEXT]: 'FontSizeOutlined',
    [DISPLAY_TYPES.SLIDER]: 'MinusOutlined',
    [DISPLAY_TYPES.CASCADER]: 'ApartmentOutlined',
    [DISPLAY_TYPES.MATRIX_RADIO]: 'BorderOutlined',
    [DISPLAY_TYPES.MATRIX_CHECKBOX]: 'DotChartOutlined',
    [DISPLAY_TYPES.PARAGRAPH]: 'AlignLeftOutlined',
    [DISPLAY_TYPES.DIVIDER]: 'MinusOutlined',
    [DISPLAY_TYPES.RANDOMIZATION]: 'ShuffleOutlined'
  };
  return icons[displayType] || 'InputOutlined';
}

/**
 * 判断是否为容器类型
 */
export function isContainerType(displayType) {
  return [DISPLAY_TYPES.GROUP, DISPLAY_TYPES.TABLE].includes(displayType);
}

/**
 * 判断是否为选项类型
 */
export function isOptionType(displayType) {
  return [DISPLAY_TYPES.RADIO, DISPLAY_TYPES.CHECKBOX, DISPLAY_TYPES.SELECT, DISPLAY_TYPES.MULTISELECT].includes(displayType);
}

/**
 * 判断是否为只读类型
 */
export function isReadOnlyType(displayType) {
  return [DISPLAY_TYPES.PARAGRAPH, DISPLAY_TYPES.DIVIDER].includes(displayType);
}

/**
 * 判断是否需要配置
 */
export function requiresConfig(displayType) {
  return [DISPLAY_TYPES.SLIDER, DISPLAY_TYPES.CASCADER, DISPLAY_TYPES.MATRIX_RADIO,
          DISPLAY_TYPES.MATRIX_CHECKBOX, DISPLAY_TYPES.RANDOMIZATION].includes(displayType);
}

/**
 * 格式化字段路径用于显示
 */
export function formatFieldPath(path) {
  if (Array.isArray(path)) {
    return path.join(' > ');
  }
  return path;
}

/**
 * 构建字段唯一路径
 */
export function buildFieldPath(folderName, groupName, fieldName) {
  const path = [folderName, groupName];
  if (fieldName) {
    path.push(fieldName);
  }
  return path.join('.');
}

/**
 * 解析字段路径
 */
export function parseFieldPath(path) {
  const parts = path.split('.');
  return {
    folderName: parts[0],
    groupName: parts[1],
    fieldName: parts[2] || null
  };
}

/**
 * 深度克隆对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  const clonedObj = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key]);
    }
  }
  return clonedObj;
}

/**
 * 合并对象
 */
export function deepMerge(target, source) {
  if (source === null || typeof source !== 'object') return source;
  if (target === null || typeof target !== 'object') return source;

  if (Array.isArray(source)) {
    return [...source];
  }

  const merged = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null &&
          !Array.isArray(source[key])) {
        merged[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        merged[key] = source[key];
      }
    }
  }
  return merged;
}
