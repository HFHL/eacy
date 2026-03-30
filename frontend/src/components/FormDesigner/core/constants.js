/**
 * FormDesigner 常量定义
 */

// 展示类型枚举
export const DISPLAY_TYPES = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  DATE: 'date',
  RADIO: 'radio',
  CHECKBOX: 'checkbox',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  FILE: 'file',
  GROUP: 'group',
  TABLE: 'table',
  // 扩展类型
  MULTI_TEXT: 'multi_text',
  SLIDER: 'slider',
  CASCADER: 'cascader',
  MATRIX_RADIO: 'matrix_radio',
  MATRIX_CHECKBOX: 'matrix_checkbox',
  PARAGRAPH: 'paragraph',
  DIVIDER: 'divider',
  RANDOMIZATION: 'randomization'
};

// 展示类型配置
export const DISPLAY_TYPE_CONFIG = {
  [DISPLAY_TYPES.TEXT]: {
    label: '文本',
    icon: 'FontSizeOutlined',
    category: 'fill',
    dataType: 'string',
    supportOptions: false
  },
  [DISPLAY_TYPES.TEXTAREA]: {
    label: '多行文本',
    icon: 'FileTextOutlined',
    category: 'fill',
    dataType: 'string',
    supportOptions: false
  },
  [DISPLAY_TYPES.NUMBER]: {
    label: '数字',
    icon: 'NumberOutlined',
    category: 'fill',
    dataType: 'number',
    supportOptions: false
  },
  [DISPLAY_TYPES.DATE]: {
    label: '日期',
    icon: 'CalendarOutlined',
    category: 'fill',
    dataType: 'string',
    format: 'date',
    supportOptions: false
  },
  [DISPLAY_TYPES.RADIO]: {
    label: '单选',
    icon: 'CheckCircleOutlined',
    category: 'select',
    dataType: 'string',
    supportOptions: true,
    displayMode: 'expanded'
  },
  [DISPLAY_TYPES.CHECKBOX]: {
    label: '多选',
    icon: 'CheckSquareOutlined',
    category: 'select',
    dataType: 'array',
    supportOptions: true,
    displayMode: 'expanded'
  },
  [DISPLAY_TYPES.SELECT]: {
    label: '下拉单选',
    icon: 'DownOutlined',
    category: 'select',
    dataType: 'string',
    supportOptions: true,
    displayMode: 'dropdown'
  },
  [DISPLAY_TYPES.MULTISELECT]: {
    label: '下拉多选',
    icon: 'CheckSquareOutlined',
    category: 'select',
    dataType: 'array',
    supportOptions: true,
    displayMode: 'dropdown'
  },
  [DISPLAY_TYPES.FILE]: {
    label: '文件',
    icon: 'UploadOutlined',
    category: 'file',
    dataType: 'string',
    supportOptions: false
  },
  [DISPLAY_TYPES.GROUP]: {
    label: '分组',
    icon: 'FolderOutlined',
    category: 'auxiliary',
    isContainer: true
  },
  [DISPLAY_TYPES.TABLE]: {
    label: '表格',
    icon: 'TableOutlined',
    category: 'auxiliary',
    isContainer: true
  },
  [DISPLAY_TYPES.MULTI_TEXT]: {
    label: '多项填空',
    icon: 'FontSizeOutlined',
    category: 'fill',
    supportOptions: false
  },
  [DISPLAY_TYPES.SLIDER]: {
    label: '滑块评分',
    icon: 'MinusOutlined',
    category: 'select',
    supportOptions: false,
    requireConfig: true
  },
  [DISPLAY_TYPES.CASCADER]: {
    label: '级联选择',
    icon: 'ApartmentOutlined',
    category: 'select',
    supportOptions: false,
    requireConfig: true
  },
  [DISPLAY_TYPES.MATRIX_RADIO]: {
    label: '矩阵单选',
    icon: 'BorderOutlined',
    category: 'matrix',
    supportOptions: false,
    requireConfig: true
  },
  [DISPLAY_TYPES.MATRIX_CHECKBOX]: {
    label: '矩阵多选',
    icon: 'DotChartOutlined',
    category: 'matrix',
    supportOptions: false,
    requireConfig: true
  },
  [DISPLAY_TYPES.PARAGRAPH]: {
    label: '段落说明',
    icon: 'AlignLeftOutlined',
    category: 'auxiliary',
    isReadOnly: true
  },
  [DISPLAY_TYPES.DIVIDER]: {
    label: '分割线',
    icon: 'MinusOutlined',
    category: 'auxiliary',
    isReadOnly: true
  },
  [DISPLAY_TYPES.RANDOMIZATION]: {
    label: '随机化分组',
    icon: 'ShuffleOutlined',
    category: 'auxiliary',
    requireConfig: true
  }
};

// 组件库分类
export const COMPONENT_CATEGORIES = {
  FILL: {
    key: 'fill',
    label: '填空',
    icon: 'EditOutlined',
    types: [DISPLAY_TYPES.TEXT, DISPLAY_TYPES.TEXTAREA, DISPLAY_TYPES.NUMBER,
            DISPLAY_TYPES.DATE, DISPLAY_TYPES.MULTI_TEXT]
  },
  SELECT: {
    key: 'select',
    label: '选择',
    icon: 'CheckSquareOutlined',
    types: [DISPLAY_TYPES.RADIO, DISPLAY_TYPES.CHECKBOX, DISPLAY_TYPES.SELECT,
            DISPLAY_TYPES.MULTISELECT, DISPLAY_TYPES.SLIDER, DISPLAY_TYPES.CASCADER]
  },
  MATRIX: {
    key: 'matrix',
    label: '矩阵',
    icon: 'BorderOutlined',
    types: [DISPLAY_TYPES.MATRIX_RADIO, DISPLAY_TYPES.MATRIX_CHECKBOX]
  },
  FILE: {
    key: 'file',
    label: '文件',
    icon: 'UploadOutlined',
    types: [DISPLAY_TYPES.FILE]
  },
  CONTAINER: {
    key: 'container',
    label: '容器',
    icon: 'AppstoreOutlined',
    types: [DISPLAY_TYPES.GROUP, DISPLAY_TYPES.TABLE]
  },
  AUXILIARY: {
    key: 'auxiliary',
    label: '辅助',
    icon: 'LineOutlined',
    types: [DISPLAY_TYPES.PARAGRAPH, DISPLAY_TYPES.DIVIDER, DISPLAY_TYPES.RANDOMIZATION]
  }
};

// 文件子类型
export const FILE_TYPES = {
  IMAGE: { value: 'image', label: '图片', accept: 'image/*' },
  PDF: { value: 'pdf', label: 'PDF', accept: '.pdf' },
  DICOM: { value: 'dicom', label: 'DICOM影像', accept: '.dcm,.dicom' },
  PATHOLOGY: { value: 'pathology', label: '病理切片', accept: '.svs,.scn,.ndpi' },
  ANY: { value: 'any', label: '任意文件', accept: '*' }
};

// 默认配置
export const DEFAULT_CONFIG = {
  group: {
    // 默认不可重复：否则用户仅新增几个“单字段”，发布后会因为 group=array(items.object) 在各处被渲染成“表格/多行记录”
    repeatable: false,
    isExtractionUnit: true      // 默认是抽取单元
  },
  table: {
    multiRow: true              // 默认多行
  },
  field: {
    nullable: true,             // 默认可为空
    editable: true,             // 默认可编辑
    sensitive: false,           // 默认非敏感
    primary: false              // 默认非主键
  }
};

// 冲突策略枚举
export const CONFLICT_POLICIES = {
  PREFER_PRIMARY: 'prefer_primary',
  PREFER_LATEST: 'prefer_latest',
  PREFER_EARLIEST: 'prefer_earliest',
  KEEP_ALL: 'keep_all',
  KEEP_FIRST: 'keep_first',
  MANUAL: 'manual',
  APPEND_MERGE: 'append_merge',
  EVOLUTION: 'evolution'
};

export const CONFLICT_POLICY_LABELS = {
  [CONFLICT_POLICIES.PREFER_PRIMARY]: '优先主要来源',
  [CONFLICT_POLICIES.PREFER_LATEST]: '优先最新值',
  [CONFLICT_POLICIES.PREFER_EARLIEST]: '优先最早值',
  [CONFLICT_POLICIES.KEEP_ALL]: '保留所有值',
  [CONFLICT_POLICIES.KEEP_FIRST]: '保留首次值',
  [CONFLICT_POLICIES.MANUAL]: '手动确认',
  [CONFLICT_POLICIES.APPEND_MERGE]: '追加合并',
  [CONFLICT_POLICIES.EVOLUTION]: '值演变追踪'
};

// 比较方式枚举
export const COMPARE_TYPES = {
  STRICT: 'strict',
  NORMALIZED: 'normalized',
  NUMERIC_TOLERANCE: 'numeric_tolerance'
};

export const COMPARE_TYPE_LABELS = {
  [COMPARE_TYPES.STRICT]: '严格比较',
  [COMPARE_TYPES.NORMALIZED]: '标准化比较',
  [COMPARE_TYPES.NUMERIC_TOLERANCE]: '数值容差'
};

// 字段验证规则类型
export const VALIDATION_TYPES = {
  MIN_LENGTH: 'minLength',
  MAX_LENGTH: 'maxLength',
  MIN: 'min',
  MAX: 'max',
  PATTERN: 'pattern'
};

// 面板宽度配置
export const PANEL_CONFIG = {
  leftPanel: {
    defaultWidth: 240,
    minWidth: 200,
    maxWidth: 320
  },
  centerPanel: {
    minWidth: 600
  },
  rightPanel: {
    defaultWidth: 360,
    minWidth: 300,
    maxWidth: 450
  }
};

// 拖拽类型
export const DND_TYPES = {
  FIELD: 'field',
  COMPONENT: 'component',
  GROUP: 'group'
};

// CSV 列定义
export const CSV_COLUMNS = {
  // 必填列
  FOLDER: '文件（访视层）',
  LEVEL1: '层级1（表单层）',
  DISPLAY_TYPE: '展示类型',

  // 可选列
  LEVEL2_10: Array.from({ length: 9 }, (_, i) => `层级${i + 2}`),
  DATA_UNIT: '数据单位',
  OPTIONS: '可选项值',
  DATA_TYPE: '数据类型',
  GROUP_REPEATABLE: 'group是否可重复',
  TABLE_MULTI_ROW: 'table是否多行',
  IS_EXTRACTION_UNIT: '是否为抽取单位组',
  PRIMARY_SOURCES: '主要来源',
  SECONDARY_SOURCES: '次要来源',
  TIME_BINDING: '时间属性字段组绑定',
  IS_SENSITIVE: '是否为敏感字段',
  IS_PRIMARY: '是否为主键级字段',
  IS_EDITABLE: '字段是否可编辑',
  FIELD_DESC: '提示词-字段说明',
  EXTRACTION_PROMPT: '抽取提示词（示例）',
  CONFLICT_POLICY: '字段冲突处理规则',
  EXTENDED_CONFIG: '扩展配置',
  FIELD_UID: '字段UID',
  IS_NULLABLE: '字段可否为空（nullable）'
};

// 模板字段类别
export const FIELD_CATEGORIES = {
  SINGLE: 'single',      // 单字段
  FORM: 'form'          // 表单字段
};

// 版本管理配置
export const VERSION_CONFIG = {
  uidPrefix: 'f_',
  uidLength: 8,
  versionFormat: 'semver'
};

// 快捷键
export const SHORTCUTS = {
  SAVE: 'ctrl+s',
  UNDO: 'ctrl+z',
  REDO: 'ctrl+y',
  COPY: 'ctrl+c',
  PASTE: 'ctrl+v',
  DELETE: 'delete',
  MOVE_UP: 'arrowup',
  MOVE_DOWN: 'arrowdown'
};
