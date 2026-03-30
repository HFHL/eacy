/**
 * 文档类型定义
 * 源数据来自 docs/开发者指南/config/doc_types.json
 * 用于表单设计器中的数据来源配置
 */

/**
 * 文档类型分类结构
 * 一级分类 -> 二级分类（具体文档类型）
 */
export const DOC_TYPE_CATEGORIES = {
  病理报告: {
    label: '病理报告',
    children: [
      '手术病理',
      '冰冻病理',
      '穿刺病理',
      '细胞学检查',
      '病理会诊',
      '骨髓活检',
      '骨髓涂片',
      '染色体分析'
    ]
  },
  实验室检查: {
    label: '实验室检查',
    children: [
      '血常规',
      '尿常规',
      '粪便常规及潜血',
      '生化检查',
      '血气分析',
      '心肌标志物',
      '肿瘤标志物',
      '感染性指标',
      '凝血功能',
      '甲状腺功能',
      '激素水平检测',
      '自身免疫抗体谱',
      '传染学检测',
      '血型检测',
      '微生物培养与药敏',
      '骨代谢指标',
      '免疫细胞亚群检测',
      '炎症/免疫细胞因子检测',
      '外泌体检测',
      '心衰标志物',
      '综合检验报告'
    ]
  },
  基因检测: {
    label: '基因检测',
    children: [
      'NGS靶向基因检测',
      '组织DNA/RNA测序',
      'ctDNA液体活检',
      '遗传病相关基因检测',
      '肿瘤免疫标志物检测',
      '单基因PCR检测',
      'FISH检测',
      'NGS全外显子/基因组测序',
      'cfDNA 定量检测',
      '循环肿瘤细胞检测(CTC)',
      'Sanger测序',
      'DNA倍体分析检测',
      '芯片检测(Array)'
    ]
  },
  影像检查: {
    label: '影像检查',
    children: [
      'CT检查',
      'MRI检查',
      '超声检查',
      'X光检查',
      'PET-CT检查',
      'PET-MR检查',
      '骨扫描',
      '乳腺钼靶摄影',
      '骨密度检测(BMD)'
    ]
  },
  内镜检查: {
    label: '内镜检查',
    children: [
      '胃肠镜检查',
      '支气管镜检查',
      '喉镜检查'
    ]
  },
  生理功能检查: {
    label: '生理功能检查',
    children: [
      '肺功能检查',
      '心电图(ECG)',
      '24小时动态心电图(Holter)',
      '动态血压监测(ABPM)',
      '脑电图(EEG)',
      '肌电图(EMG)',
      '诱发电位检查(EP)',
      '动脉硬化检测'
    ]
  },
  专科检查: {
    label: '专科检查',
    children: [
      '眼底检查',
      '视力与视野检查',
      '角膜地形图',
      '产科相关记录',
      '口腔科记录'
    ]
  },
  病历记录: {
    label: '病历记录',
    children: [
      '门诊病历',
      '入院记录',
      '病程记录',
      '出院小结/记录',
      '病案首页',
      '护理记录',
      '医嘱单',
      '急诊记录',
      '诊断证明',
      '会诊单/记录',
      '转科记录',
      '死亡记录/讨论记录',
      '营养会诊/评估记录',
      '综合病历',
      '入院护理评估记录单',
      '麻醉访视记录单',
      '手术风险评估表',
      '营养风险筛查表(NRS-2002)',
      'VTE风险评估表'
    ]
  },
  治疗记录: {
    label: '治疗记录',
    children: [
      '手术记录',
      '放疗记录',
      '麻醉记录',
      '化疗记录',
      '靶向/免疫治疗记录',
      '输血记录',
      '康复治疗记录'
    ]
  },
  其他材料: {
    label: '其他材料',
    children: [
      '处方单',
      '费用明细清单',
      '发票',
      '检查/入院预约单',
      '治疗同意书',
      '病假条',
      '病危/病重通知书',
      '死亡证明'
    ]
  }
};

/**
 * 转换为 TreeSelect 需要的数据格式
 * @returns {Array} TreeSelect treeData
 */
export const getDocTypeTreeData = () => {
  return Object.entries(DOC_TYPE_CATEGORIES).map(([key, category]) => ({
    title: category.label,
    value: key,
    key: key,
    selectable: false, // 一级分类不可选，只能选二级
    children: category.children.map(child => ({
      title: child,
      value: child,
      key: `${key}-${child}`
    }))
  }));
};

/**
 * 转换为 Cascader 需要的数据格式（支持多选）
 * @returns {Array} Cascader options
 */
export const getDocTypeCascaderOptions = () => {
  return Object.entries(DOC_TYPE_CATEGORIES).map(([key, category]) => ({
    label: category.label,
    value: key,
    children: category.children.map(child => ({
      label: child,
      value: child
    }))
  }));
};

/**
 * 获取所有文档类型的扁平列表
 * @returns {Array} 所有二级文档类型
 */
export const getAllDocTypes = () => {
  const allTypes = [];
  Object.values(DOC_TYPE_CATEGORIES).forEach(category => {
    allTypes.push(...category.children);
  });
  return allTypes;
};

/**
 * 根据文档类型获取其所属分类
 * @param {string} docType 文档类型名称
 * @returns {string|null} 分类名称
 */
export const getCategoryByDocType = (docType) => {
  for (const [key, category] of Object.entries(DOC_TYPE_CATEGORIES)) {
    if (category.children.includes(docType)) {
      return category.label;
    }
  }
  return null;
};

export default DOC_TYPE_CATEGORIES;


