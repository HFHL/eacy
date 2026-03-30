/**
 * FormDesigner 主容器组件
 * 表单设计器的顶层组件，负责协调各个子组件
 * 注意：顶部工具栏由父组件提供，此组件只包含设计器本身
 */

import React, { useState, useCallback, useMemo, useRef, useImperativeHandle, forwardRef } from 'react';
import { message, Tabs, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSchemaParser } from './hooks/useSchemaParser';
import { useDesignData } from './hooks/useDesignData';
import { useKeyboardShortcuts, SHORTCUT_KEYS } from './hooks/useKeyboardShortcuts';
import SchemaGenerator from './core/SchemaGenerator';
import { CSVConverter } from './utils/csvConverter';
import FieldModal from './components/FieldModal';
import { FolderTree, ComponentLibrary } from './components/LeftPanel';
import { DesignCanvas } from './components/CenterPanel';
import { FormConfigPanel, FieldConfigPanel } from './components/RightPanel';
import ResizablePanels from './components/ResizablePanels';
import PreviewModal from './components/PreviewModal';
import { DISPLAY_TYPE_CONFIG } from './core/constants';
import './styles.less';

const { TabPane } = Tabs;

/**
 * FormDesigner 主组件
 * @param {Object} props
 * @param {string} props.schemaPath - Schema文件路径
 * @param {Function} props.onSave - 保存回调函数
 * @param {Function} props.onBack - 返回回调函数
 * @param {boolean} props.readonly - 是否只读模式
 * @param {boolean} props.showToolbar - 是否显示内部工具栏（默认false，由父组件提供）
 */
const FormDesigner = forwardRef(({
  schemaPath = null,
  onSave = null,
  onBack = null,
  readonly = false,
  showToolbar = false,
  docTypeOptions = []
}, ref) => {
  const navigate = useNavigate();

  // 设计数据管理
  const designData = useDesignData();

  // Schema解析器
  const schemaParser = useSchemaParser({
    onParseSuccess: (data) => {
      designData.resetData(data);
      message.success('Schema加载成功');
    },
    onParseError: (errors) => {
      message.error(`Schema解析失败: ${errors.map(e => e.message).join(', ')}`);
    },
    onGenerateSuccess: (schema) => {
      if (onSave) {
        onSave(schema);
      }
    }
  });

  // UI状态
  const [fieldModalVisible, setFieldModalVisible] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [leftPanelTab, setLeftPanelTab] = useState('structure');
  const [rightPanelTab, setRightPanelTab] = useState('field');

  // 选择状态 - 扩展支持嵌套字段选择
  // selectionPath: 数组形式，支持多层嵌套
  // [{ type: 'folder', id: 'xxx', name: 'yyy' }, { type: 'group', id: 'xxx', name: 'yyy' }, ...]
  const [selectionPath, setSelectionPath] = useState([]);

  // 便捷获取函数
  const selectedFolderId = selectionPath.find(i => i.type === 'folder')?.id || null;
  const selectedGroupId = selectionPath.find(i => i.type === 'group')?.id || null;
  const selectedFieldId = selectionPath.find(i => i.type === 'field')?.id || null;

  // 获取最深层的选择对象（用于配置面板）
  const getDeepestSelection = () => {
    if (selectionPath.length === 0) return null;
    return selectionPath[selectionPath.length - 1];
  };

  // 导航到指定层级
  const navigateToLevel = (level) => {
    setSelectionPath(prev => prev.slice(0, level + 1));
  };

  // 当选择字段时，自动切换到字段配置标签
  React.useEffect(() => {
    const deepest = getDeepestSelection();
    if (deepest?.type === 'field' || deepest?.type === 'child') {
      setRightPanelTab('field');
    } else if (deepest?.type === 'group' || deepest?.type === 'folder') {
      setRightPanelTab('form');
    }
  }, [selectionPath]);

  // 配置快捷键
  useKeyboardShortcuts(
    {
      [SHORTCUT_KEYS.SAVE]: () => {
        if (!readonly) {
          handleSaveSchema();
        }
      },
      [SHORTCUT_KEYS.DELETE]: () => {
        if (!readonly && selectionPath.length > 0) {
          const deepest = getDeepestSelection();
          const folder = selectionPath.find(i => i.type === 'folder');
          const group = selectionPath.find(i => i.type === 'group');
          const field = selectionPath.find(i => i.type === 'field');

          if (deepest?.type === 'field' && folder?.id && group?.id && field?.id) {
            handleDeleteField(folder.id, group.id, field.id);
          } else if (deepest?.type === 'child' && folder?.id && group?.id && field?.id) {
            // 删除子字段
            const childId = deepest.id;
            // TODO: 实现删除子字段逻辑
          }
        }
      },
      [SHORTCUT_KEYS.BACKSPACE]: () => {
        // 只在非输入框中触发删除
        const target = document.activeElement;
        const isInInput = (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.contentEditable === 'true'
        );
        if (!readonly && !isInInput && selectionPath.length > 0) {
          const deepest = getDeepestSelection();
          const folder = selectionPath.find(i => i.type === 'folder');
          const group = selectionPath.find(i => i.type === 'group');
          const field = selectionPath.find(i => i.type === 'field');

          if (deepest?.type === 'field' && folder?.id && group?.id && field?.id) {
            handleDeleteField(folder.id, group.id, field.id);
          }
        }
      },
      [SHORTCUT_KEYS.ESC]: () => {
        // 清除选择 - 回到上一层或全部清除
        if (selectionPath.length > 0) {
          setSelectionPath(prev => prev.slice(0, -1));
        }
        // 关闭模态框
        if (fieldModalVisible) {
          setFieldModalVisible(false);
          setEditingField(null);
        }
      },
      [SHORTCUT_KEYS.PREVIEW]: () => {
        setPreviewVisible(true);
      },
      [SHORTCUT_KEYS.EXPORT]: () => {
        handleDownloadSchema();
      }
    },
    !readonly && !fieldModalVisible && !previewVisible
  );

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    // 获取当前设计数据
    getData: () => designData.getData(),

    // 加载设计数据
    loadData: (data) => {
      designData.resetData(data);
      message.success('数据加载成功');
    },

    // 加载JSON Schema
    loadSchema: async (schema) => {
      try {
        const result = schemaParser.parseSchema(schema);
        if (!result.success) {
          const errMsg = result.errors?.map(e => e.message).join(', ') || '未知错误';
          message.error(`Schema解析失败: ${errMsg}`);
          return null;
        }
        const parsedData = result.data;
        designData.resetData(parsedData);

        // 自动选中第一个文件夹和第一个组
        if (parsedData.folders && parsedData.folders.length > 0) {
          const firstFolder = parsedData.folders[0];
          const newPath = [
            { type: 'folder', id: firstFolder.id, name: firstFolder.name }
          ];
          if (firstFolder.groups && firstFolder.groups.length > 0) {
            const firstGroup = firstFolder.groups[0];
            newPath.push({ type: 'group', id: firstGroup.id, name: firstGroup.name });
          }
          setSelectionPath(newPath);
        }

        message.success('Schema加载成功');
        return parsedData;
      } catch (error) {
        message.error(`Schema解析失败: ${error.message}`);
        throw error;
      }
    },

    // 导出JSON Schema
    exportSchema: () => {
      const schema = SchemaGenerator.generateSchema(designData.getData());
      return schema;
    },

    // 导出CSV
    exportCSV: () => {
      const csvData = CSVConverter.designModelToCSV(designData.getData());
      return csvData;
    },

    // 导入CSV
    importCSV: async (file) => {
      try {
        const designModel = await CSVConverter.importCSV(file);
        designData.resetData(designModel);

        // 自动选中第一个文件夹和第一个组
        if (designModel.folders.length > 0) {
          const firstFolder = designModel.folders[0];
          const newPath = [
            { type: 'folder', id: firstFolder.id, name: firstFolder.name }
          ];
          if (firstFolder.groups.length > 0) {
            const firstGroup = firstFolder.groups[0];
            newPath.push({ type: 'group', id: firstGroup.id, name: firstGroup.name });
          }
          setSelectionPath(newPath);
        }

        message.success('CSV导入成功');
        return designModel;
      } catch (error) {
        message.error(`CSV导入失败: ${error.message}`);
        throw error;
      }
    },

    // 刷新数据
    refresh: () => {
      // 触发重新渲染
      setSelectionPath(prev => [...prev]);
    },

    // 打开预览
    preview: () => {
      setPreviewVisible(true);
    }
  }), [designData, schemaParser, setSelectionPath]);  // 更新依赖

  // 获取当前数据；依赖 version 强制重新解析选中对象，避免右侧面板拿到旧引用
  const data = useMemo(() => designData.getData(), [designData.version]);
  const stats = designData.getStatistics();

  const syncSelectionPathName = useCallback((type, id, newName) => {
    setSelectionPath(prev => prev.map(item => (
      item.type === type && item.id === id
        ? { ...item, name: newName }
        : item
    )));
  }, []);

  // 获取选中的对象 - 支持嵌套路径
  const getSelectedObjectByPath = useCallback((path) => {
    let current = null;
    let folder = null;
    let group = null;
    let field = null;
    let childField = null;

    for (const item of path) {
      if (item.type === 'folder') {
        folder = data.folders.find(f => f.id === item.id);
        current = folder;
      } else if (item.type === 'group' && folder) {
        group = folder.groups.find(g => g.id === item.id);
        current = group;
      } else if (item.type === 'field' && group) {
        field = group.fields.find(f => f.id === item.id);
        current = field;
      } else if (item.type === 'child' && field) {
        // 获取子字段
        if (field.children) {
          childField = field.children.find(f => f.id === item.id);
          current = childField;
        }
      }
    }

    return { folder, group, field, childField, current };
  }, [data, designData.version]);

  // 选中的对象（兼容旧代码）
  const selectedObjects = useMemo(() => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');
    const field = selectionPath.find(i => i.type === 'field');
    const child = selectionPath.find(i => i.type === 'child');

    const result = getSelectedObjectByPath(selectionPath);
    return {
      folder: result.folder,
      group: result.group,
      field: result.current,  // 返回最深层选中的对象
      childField: result.childField
    };
  }, [selectionPath, getSelectedObjectByPath, designData.version]);

  // 加载Schema
  const handleLoadSchema = useCallback((file) => {
    schemaParser.loadSchemaFromFile(file);
  }, [schemaParser]);

  // 保存Schema
  const handleSaveSchema = useCallback(() => {
    const schema = SchemaGenerator.generateSchema(designData.getData());
    const validation = designData.validateDesign();

    if (!validation.valid) {
      message.error(`设计数据验证失败: ${validation.errors.map(e => e.message).join(', ')}`);
      return;
    }

    if (onSave) {
      onSave(schema);
    }

    message.success('Schema保存成功');
  }, [designData, onSave]);

  // 下载Schema
  const handleDownloadSchema = useCallback(() => {
    const schema = SchemaGenerator.generateSchema(designData.getData());
    schemaParser.downloadSchema(schema, data.meta.$id || 'schema.json');
  }, [designData, schemaParser, data.meta.$id]);

  // 处理树节点选择 - 支持嵌套字段选择
  const handleTreeSelect = useCallback(({ folderId, groupId, fieldId, childFieldId }) => {
    const newPath = [];

    if (folderId) {
      const folder = data.folders.find(f => f.id === folderId);
      if (folder) newPath.push({ type: 'folder', id: folderId, name: folder.name });

      if (groupId && folder) {
        const group = folder.groups.find(g => g.id === groupId);
        if (group) newPath.push({ type: 'group', id: groupId, name: group.name });

        if (fieldId && group) {
          const field = group.fields.find(f => f.id === fieldId);
          if (field) newPath.push({ type: 'field', id: fieldId, name: field.name });

          if (childFieldId && field?.children) {
            const child = field.children.find(f => f.id === childFieldId);
            if (child) newPath.push({ type: 'child', id: childFieldId, name: child.name });
          }
        }
      }
    }

    setSelectionPath(newPath);
  }, [data]);

  // 处理画布选择 - 支持嵌套字段选择
  const handleCanvasSelect = useCallback(({ folderId, groupId, fieldId, childFieldId }) => {
    const newPath = [];

    if (folderId) {
      const folder = data.folders.find(f => f.id === folderId);
      if (folder) newPath.push({ type: 'folder', id: folderId, name: folder.name });

      if (groupId && folder) {
        const group = folder.groups.find(g => g.id === groupId);
        if (group) newPath.push({ type: 'group', id: groupId, name: group.name });

        if (fieldId && group) {
          const field = group.fields.find(f => f.id === fieldId);
          if (field) newPath.push({ type: 'field', id: fieldId, name: field.name });

          if (childFieldId && field?.children) {
            const child = field.children.find(f => f.id === childFieldId);
            if (child) newPath.push({ type: 'child', id: childFieldId, name: child.name });
          }
        }
      }
    }

    setSelectionPath(newPath);
  }, [data]);

  // 处理拖拽添加字段
  const handleDropField = useCallback((fieldType, folderId, groupId, fieldSubType) => {
    if (!folderId || !groupId) {
      message.warning('请先选择表单组');
      return;
    }

    // 获取字段类型的中文名称
    const typeConfig = DISPLAY_TYPE_CONFIG[fieldType];
    const defaultName = typeConfig?.label || fieldType;

    // 根据字段类型设置默认值
    let newField = {
      displayType: fieldType,
      name: defaultName,
      dataType: 'string',
      editable: true,
      nullable: true,
      required: false
    };

    // 为特定字段类型设置默认配置
    switch (fieldType) {
      case 'randomization':
        newField = {
          ...newField,
          name: '分组',
          options: ['试验组', '对照组']
        };
        break;
      case 'file':
        // 根据文件子类型设置不同的名称和配置
        const fileSubtype = fieldSubType || 'any';
        let fileName = '文件上传';
        switch (fileSubtype) {
          case 'image':
            fileName = '图片上传';
            break;
          case 'pdf':
            fileName = 'PDF文件';
            break;
          case 'dicom':
            fileName = 'DICOM影像';
            break;
          case 'pathology':
            fileName = '病理切片';
            break;
          case 'any':
          default:
            fileName = '文件题';
            break;
        }
        newField = {
          ...newField,
          name: fileName,
          fileSubtype: fileSubtype
        };
        break;
      case 'radio':
      case 'checkbox':
        newField = {
          ...newField,
          options: ['选项1', '选项2', '选项3']
        };
        break;
      case 'select':
      case 'multiselect':
        newField = {
          ...newField,
          options: ['选项1', '选项2', '选项3']
        };
        break;
      case 'matrix_radio':
      case 'matrix_checkbox':
        newField = {
          ...newField,
          config: {
            rows: ['题目1', '题目2'],
            cols: ['选项1', '选项2', '选项3']
          }
        };
        break;
      case 'table':
        // 根据 subType 判断是固定表格还是自增表格
        const isMultiRow = fieldSubType === 'dynamic';
        newField = {
          ...newField,
          name: isMultiRow ? '自增表格' : '固定表格',
          multiRow: isMultiRow,
          children: []
        };
        break;
      default:
        break;
    }

    designData.addField(folderId, groupId, newField);
    message.success('字段已添加');
  }, [designData]);

  // 添加字段
  const handleAddField = useCallback((folderId, groupId) => {
    setEditingField({
      _context: { folderId, groupId }
    });
    setFieldModalVisible(true);
  }, []);

  // 编辑字段
  const handleEditField = useCallback((folderId, groupId, fieldId) => {
    const { field } = selectedObjects;

    if (!field) {
      message.warning('请先选择要编辑的字段');
      return;
    }

    setEditingField({
      ...field,
      _context: { folderId, groupId, fieldId }
    });
    setFieldModalVisible(true);
  }, [selectedObjects]);

  // 保存字段
  const handleSaveField = useCallback((fieldData) => {
    const { _context, ...field } = fieldData;

    if (field.id) {
      // 编辑现有字段
      designData.updateField(
        _context.folderId,
        _context.groupId,
        _context.fieldId,
        field
      );
    } else {
      // 添加新字段
      designData.addField(_context.folderId, _context.groupId, field);
    }

    setFieldModalVisible(false);
    setEditingField(null);
  }, [designData]);

  // 删除字段
  const handleDeleteField = useCallback((folderId, groupId, fieldId) => {
    designData.deleteField(folderId, groupId, fieldId);
    message.success('字段已删除');
    setSelectionPath(prev => prev.filter(p => p.type !== 'field'));
  }, [designData]);

  // 复制字段
  const handleCopyField = useCallback((folderId, groupId, fieldId) => {
    designData.duplicateField(folderId, groupId, fieldId);
    message.success('字段已复制');
  }, [designData]);

  // 字段重新排序
  const handleFieldReorder = useCallback((folderId, groupId, newFields) => {
    designData.updateGroup(folderId, groupId, { fields: newFields });
  }, [designData]);

  // 修改字段名称（同步更新显示名称）
  const handleFieldNameChange = useCallback((folderId, groupId, fieldId, newName) => {
    designData.updateField(folderId, groupId, fieldId, { name: newName, displayName: newName });
    syncSelectionPathName('field', fieldId, newName);
  }, [designData, syncSelectionPathName]);

  // 修改字段选项
  const handleOptionsChange = useCallback((folderId, groupId, fieldId, newOptions) => {
    designData.updateField(folderId, groupId, fieldId, { options: newOptions });
  }, [designData]);

  // 修改表单名称
  const handleGroupNameChange = useCallback((folderId, groupId, newName) => {
    designData.updateGroup(folderId, groupId, { name: newName });
  }, [designData]);

  // 加载示例数据
  const handleLoadExample = useCallback(() => {
    const exampleData = {
      meta: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $id: 'example-crf',
        title: '示例CRF模版',
        version: '1.0.0',
        projectId: 'example',
        createdAt: new Date().toISOString()
      },
      folders: [
        {
          id: 'folder_visit1',
          name: '基线访视',
          description: '患者基线信息收集',
          order: 0,
          groups: [
            {
              id: 'group_basic',
              uid: null,
              name: '基本信息',
              displayName: '基本信息',
              type: 'group',  // 必须设置为group类型
              repeatable: false,  // 基本信息不可重复
              isExtractionUnit: true,  // 默认为抽取单元
              mergeBinding: null,
              sources: null,
              description: '患者基本信息',
              order: 0,
              config: {},
              required: [],
              fields: [
                {
                  id: 'field_name',
                  uid: null,
                  name: '患者姓名',
                  displayName: '患者姓名',
                  displayType: 'text',
                  dataType: 'string',
                  unit: null,
                  required: true,
                  nullable: false,
                  sensitive: true,
                  primary: false,
                  editable: true,
                  order: 0,
                  description: '患者真实姓名',
                  extractionPrompt: '从文档中提取患者姓名',
                  conflictPolicy: null,
                  format: null,
                  defaultValue: null,
                  options: null,
                  optionsId: null,
                  children: null,
                  config: null,
                  category: 'single'
                },
                {
                  id: 'field_gender',
                  uid: null,
                  name: '性别',
                  displayName: '性别',
                  displayType: 'radio',
                  dataType: 'string',
                  unit: null,
                  required: true,
                  nullable: false,
                  sensitive: false,
                  primary: false,
                  editable: true,
                  order: 1,
                  description: '患者性别',
                  extractionPrompt: '从文档中提取患者性别',
                  options: ['男', '女', '不详'],
                  optionsId: null,
                  format: null,
                  defaultValue: null,
                  conflictPolicy: null,
                  children: null,
                  config: null,
                  category: 'single'
                },
                {
                  id: 'field_age',
                  uid: null,
                  name: '年龄',
                  displayName: '年龄',
                  displayType: 'number',
                  dataType: 'number',
                  unit: '岁',
                  required: true,
                  nullable: true,
                  sensitive: false,
                  primary: false,
                  editable: true,
                  order: 2,
                  description: '患者年龄',
                  extractionPrompt: '从文档中提取患者年龄，单位为岁',
                  conflictPolicy: null,
                  format: null,
                  defaultValue: null,
                  options: null,
                  optionsId: null,
                  children: null,
                  config: null,
                  category: 'single'
                }
              ]
            },
            {
              id: 'group_vital',
              uid: null,
              name: '生命体征',
              displayName: '生命体征',
              type: 'group',
              repeatable: true,  // 生命体征可重复(多次测量)
              isExtractionUnit: true,
              mergeBinding: 'anchor=测量日期',
              sources: {
                primary: ['体格检查'],
                secondary: ['病程记录']
              },
              description: '患者生命体征',
              order: 1,
              config: {},
              required: [],
              fields: [
                {
                  id: 'field_weight',
                  uid: null,
                  name: '体重',
                  displayName: '体重',
                  displayType: 'number',
                  dataType: 'number',
                  unit: 'kg',
                  required: false,
                  nullable: true,
                  sensitive: false,
                  primary: false,
                  editable: true,
                  order: 0,
                  description: '患者体重',
                  extractionPrompt: '从文档中提取体重数据，单位为kg',
                  conflictPolicy: 'policy=prefer_latest;compare=numeric_tolerance',
                  format: null,
                  defaultValue: null,
                  options: null,
                  optionsId: null,
                  children: null,
                  config: null,
                  category: 'single'
                },
                {
                  id: 'field_height',
                  uid: null,
                  name: '身高',
                  displayName: '身高',
                  displayType: 'number',
                  dataType: 'number',
                  unit: 'cm',
                  required: false,
                  nullable: true,
                  sensitive: false,
                  primary: false,
                  editable: true,
                  order: 1,
                  description: '患者身高',
                  extractionPrompt: '从文档中提取身高数据，单位为cm',
                  conflictPolicy: 'policy=prefer_latest;compare=numeric_tolerance',
                  format: null,
                  defaultValue: null,
                  options: null,
                  optionsId: null,
                  children: null,
                  config: null,
                  category: 'single'
                }
              ]
            }
          ]
        }
      ],
      enums: {},
      selectedFolderId: null,
      selectedGroupId: null,
      selectedFieldId: null,
      expandedFolderIds: [],
      expandedGroupIds: []
    };

    designData.resetData(exampleData);
    setSelectionPath([
      { type: 'folder', id: 'folder_visit1', name: '基线访视' },
      { type: 'group', id: 'group_basic', name: '基本信息' }
    ]);
    message.success('示例数据已加载');
  }, [designData]);

  // 添加访视（文件夹）- 直接创建未命名分类，进入编辑模式
  const handleAddFolder = useCallback(() => {
    const newFolder = {
      name: '未命名分类',
      description: '',
      order: data.folders.length,
      groups: [],
      isNew: true // 标记为新建，用于自动进入编辑模式
    };

    const folder = designData.addFolder(newFolder);
    setSelectionPath([{ type: 'folder', id: folder.id, name: folder.name }]);
  }, [designData, data.folders.length]);

  // 删除访视（文件夹）
  const handleDeleteFolder = useCallback((folderId) => {
    const folder = data.folders.find(f => f.id === folderId);
    if (!folder) return;

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除访视"${folder.name}"吗？该操作将删除访视下的所有表单和字段。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        designData.deleteFolder(folderId);
        // 清除选择或回到上一层级
        setSelectionPath(prev => {
          const wasSelected = prev.some(p => p.id === folderId);
          return wasSelected ? [] : prev.filter(p => p.id !== folderId);
        });
        message.success('访视已删除');
      }
    });
  }, [designData, data.folders]);

  // 编辑访视（文件夹）- 支持直接传入新名称（来自内联编辑）
  const handleEditFolder = useCallback((folderId, newName) => {
    const folder = data.folders.find(f => f.id === folderId);
    if (!folder) return;

    if (newName && newName !== folder.name) {
      // 更新名称并清除 isNew 标记
      designData.updateFolder(folderId, { name: newName, isNew: false });
    } else if (folder.isNew) {
      // 如果名称未改变但是新建的，也清除 isNew 标记
      designData.updateFolder(folderId, { isNew: false });
    }
  }, [designData, data.folders]);

  // 复制访视（文件夹）
  const handleCopyFolder = useCallback((folderId) => {
    const folder = data.folders.find(f => f.id === folderId);
    if (!folder) return;

    // 深拷贝文件夹数据
    const copiedFolder = {
      name: `${folder.name}_复制`,
      description: folder.description || '',
      order: data.folders.length,
      groups: (folder.groups || []).map(group => ({
        ...group,
        id: undefined, // 让系统生成新ID
        fields: (group.fields || []).map(field => ({
          ...field,
          id: undefined, // 让系统生成新ID
          uid: undefined // 让系统生成新UID
        }))
      }))
    };

    const newFolder = designData.addFolder(copiedFolder);
    
    // 为复制的组添加字段
    if (folder.groups && folder.groups.length > 0) {
      folder.groups.forEach((group, groupIndex) => {
        const newGroup = designData.addGroup(newFolder.id, {
          name: group.name,
          description: group.description,
          order: groupIndex,
          fields: []
        });
        
        // 复制字段
        (group.fields || []).forEach(field => {
          designData.addField(newFolder.id, newGroup.id, {
            ...field,
            id: undefined,
            uid: undefined
          });
        });
      });
    }

    setSelectionPath([{ type: 'folder', id: newFolder.id, name: newFolder.name }]);
    message.success('访视已复制');
  }, [designData, data.folders]);

  // 添加表单（字段组）- 自动创建"未命名表单"
  const handleAddGroup = useCallback((folderId) => {
    if (!folderId) {
      message.warning('请先选择访视');
      return;
    }

    const folder = data.folders.find(f => f.id === folderId);
    const existingCount = folder?.groups?.length || 0;

    // 自动创建未命名表单，不需要弹窗
    const newGroup = {
      name: '未命名表单',
      description: '',
      order: existingCount,
      fields: [],
      isNew: true // 标记为新建，用于触发名称编辑
    };

    const group = designData.addGroup(folderId, newGroup);
    setSelectionPath([
      { type: 'folder', id: folderId, name: folder?.name },
      { type: 'group', id: group.id, name: group.name }
    ]);
    // 不显示消息，直接进入编辑模式
  }, [designData, data.folders]);

  // 编辑表单名称
  const handleEditGroupName = useCallback((folderId, groupId, newName) => {
    if (!newName || !newName.trim()) {
      message.warning('表单名称不能为空');
      return;
    }
    designData.updateGroup(folderId, groupId, {
      name: newName.trim(),
      isNew: false // 清除新建标记
    });
  }, [designData]);

  // 删除表单
  const handleDeleteGroup = useCallback((folderId, groupId) => {
    const folder = data.folders.find(f => f.id === folderId);
    const group = folder?.groups?.find(g => g.id === groupId);
    if (!group) return;

    Modal.confirm({
      title: '确认删除',
      content: `确定要删除表单"${group.name}"吗？该操作将删除表单下的所有字段。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        designData.deleteGroup(folderId, groupId);
        // 清除选择或回到上一层
        setSelectionPath(prev => {
          const wasSelected = prev.some(p => p.id === groupId);
          return wasSelected ? prev.slice(0, 1) : prev.filter(p => p.id !== groupId);
        });
        message.success('表单已删除');
      }
    });
  }, [designData, data.folders]);

  // 更新表单/组配置
  const handleUpdateGroup = useCallback((updates) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (group && folder) {
      designData.updateGroup(folder.id, group.id, updates);
    } else if (folder) {
      designData.updateFolder(folder.id, updates);
    }
  }, [designData, selectionPath]);

  // 更新字段配置 - 支持嵌套字段
  const handleUpdateField = useCallback((updates) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');
    const field = selectionPath.find(i => i.type === 'field');
    const child = selectionPath.find(i => i.type === 'child');

    if (!folder || !group) return;

    // 修改字段名称时同步更新显示名称
    if (updates.name !== undefined) {
      updates = { ...updates, displayName: updates.name };
    }

    if (child && field) {
      // 更新子字段
      designData.updateChildField(folder.id, group.id, field.id, child.id, updates);
      if (updates.name !== undefined) {
        syncSelectionPathName('child', child.id, updates.name);
      }
    } else if (field) {
      // 更新字段
      designData.updateField(folder.id, group.id, field.id, updates);
      if (updates.name !== undefined) {
        syncSelectionPathName('field', field.id, updates.name);
      }
    }
  }, [designData, selectionPath, syncSelectionPathName]);

  // 应用表单模板
  const handleApplyTemplate = useCallback((folderId, groupId, template) => {
    if (!template || !template.fields || template.fields.length === 0) {
      message.info('该模板暂无预设字段');
      return;
    }

    // 批量添加模板中的字段
    template.fields.forEach(fieldConfig => {
      designData.addField(folderId, groupId, {
        name: fieldConfig.name,
        displayName: fieldConfig.name,
        displayType: fieldConfig.displayType || 'text',
        unit: fieldConfig.unit || null,
        description: fieldConfig.description || '',
        nullable: true,
        editable: true
      });
    });

    message.success(`已应用模板"${template.name}"，添加了 ${template.fields.length} 个字段`);
  }, [designData]);

  // 处理子字段选择
  const handleChildSelect = useCallback((fieldId, childFieldId) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) return;

    // 找到字段
    const groupObj = data.folders.find(f => f.id === folder.id)?.groups.find(g => g.id === group.id);
    const field = groupObj?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const child = field.children?.find(c => c.id === childFieldId);
    if (!child) return;

    // 更新选择路径，添加子字段
    setSelectionPath(prev => [
      ...prev.filter(p => p.type !== 'child'),
      { type: 'field', id: fieldId, name: field.name },
      { type: 'child', id: childFieldId, name: child.name }
    ]);
  }, [data, selectionPath]);

  // 处理添加表格子字段（表格列）
  const handleAddTableChild = useCallback((fieldId) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) {
      message.warning('请先选择表单');
      return;
    }

    const newChild = {
      name: `列_${Math.random().toString(36).substr(2, 4)}`,
      displayName: `列_${Math.random().toString(36).substr(2, 4)}`,
      displayType: 'text',
      dataType: 'string',
      description: ''
    };

    const createdChild = designData.addChildField(folder.id, group.id, fieldId, newChild);
    if (createdChild?.id) {
      const field = data.folders
        .find(f => f.id === folder.id)
        ?.groups.find(g => g.id === group.id)
        ?.fields.find(f => f.id === fieldId);
      setSelectionPath([
        { type: 'folder', id: folder.id, name: folder.name },
        { type: 'group', id: group.id, name: group.name },
        { type: 'field', id: fieldId, name: field?.name || '表格字段' },
        { type: 'child', id: createdChild.id, name: createdChild.name || createdChild.displayName || '新子字段' }
      ]);
    }
    message.success('表格列已添加');
  }, [data.folders, designData, selectionPath]);

  // 处理删除表格子字段（表格列）
  const handleDeleteTableChild = useCallback((fieldId, childIndex) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) return;

    const groupObj = data.folders.find(f => f.id === folder.id)?.groups.find(g => g.id === group.id);
    const field = groupObj?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const children = field.children || [];
    if (children.length <= 1) {
      message.warning('至少保留一个表格列');
      return;
    }

    const deletedChild = children[childIndex];

    const newChildren = children.filter((_, idx) => idx !== childIndex);
    designData.updateField(folder.id, group.id, fieldId, {
      children: newChildren
    });
    if (deletedChild?.id) {
      setSelectionPath(prev => {
        const selectedChild = prev.find(item => item.type === 'child');
        if (selectedChild?.id !== deletedChild.id) return prev;
        return prev.filter(item => item.type !== 'child');
      });
    }
    message.success('表格列已删除');
  }, [data, designData, selectionPath]);

  // 处理表格子字段（列）拖拽排序
  const handleReorderTableChildren = useCallback((folderId, groupId, fieldId, newChildren) => {
    if (!folderId || !groupId || !fieldId) return;
    designData.updateField(folderId, groupId, fieldId, {
      children: newChildren
    });
  }, [designData]);

  // 处理添加表格行（仅自增表格）
  const handleAddTableRow = useCallback((fieldId) => {
    // TODO: 实现添加表格行的逻辑
    message.info('添加表格行功能待实现');
  }, []);

  // 处理编辑行标题
  const handleEditRowPrefix = useCallback((fieldId) => {
    // TODO: 实现编辑行标题的逻辑
    message.info('编辑行标题功能待实现');
  }, []);

  // 处理添加矩阵行（题目）
  const handleAddMatrixRow = useCallback((fieldId) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) return;

    const groupObj = data.folders.find(f => f.id === folder.id)?.groups.find(g => g.id === group.id);
    const field = groupObj?.fields.find(f => f.id === fieldId);
    if (!field) return;

    // 使用与渲染一致的默认值
    const existingConfig = field.config || {};
    const config = {
      rows: existingConfig.rows || ['题目1', '题目2'],
      cols: existingConfig.cols || ['选项1', '选项2', '选项3']
    };
    
    // 添加新题目
    const newRowIndex = config.rows.length + 1;
    config.rows = [...config.rows, `题目${newRowIndex}`];

    designData.updateField(folder.id, group.id, fieldId, {
      config: { ...config }
    });
    message.success('题目已添加');
  }, [data, designData, selectionPath]);

  // 处理删除矩阵行（题目）
  const handleDeleteMatrixRow = useCallback((fieldId, rowIdx) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) return;

    const groupObj = data.folders.find(f => f.id === folder.id)?.groups.find(g => g.id === group.id);
    const field = groupObj?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const existingConfig = field.config || {};
    const rows = existingConfig.rows || ['题目1', '题目2'];
    
    if (rows.length <= 1) {
      message.warning('至少保留一个题目');
      return;
    }

    const newRows = rows.filter((_, idx) => idx !== rowIdx);

    designData.updateField(folder.id, group.id, fieldId, {
      config: { 
        ...existingConfig, 
        rows: newRows,
        cols: existingConfig.cols || ['选项1', '选项2', '选项3']
      }
    });
    message.success('题目已删除');
  }, [data, designData, selectionPath]);

  // 处理复制矩阵行（题目）
  const handleCopyMatrixRow = useCallback((fieldId, rowIdx) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) return;

    const groupObj = data.folders.find(f => f.id === folder.id)?.groups.find(g => g.id === group.id);
    const field = groupObj?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const existingConfig = field.config || {};
    const rows = existingConfig.rows || ['题目1', '题目2'];
    
    // 复制选中的行到下一个位置
    const copiedRow = rows[rowIdx] + ' (副本)';
    const newRows = [
      ...rows.slice(0, rowIdx + 1),
      copiedRow,
      ...rows.slice(rowIdx + 1)
    ];

    designData.updateField(folder.id, group.id, fieldId, {
      config: { 
        ...existingConfig, 
        rows: newRows,
        cols: existingConfig.cols || ['选项1', '选项2', '选项3']
      }
    });
    message.success('题目已复制');
  }, [data, designData, selectionPath]);

  // 处理删除矩阵列（选项）
  const handleDeleteMatrixCol = useCallback((fieldId, colIdx) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) return;

    const groupObj = data.folders.find(f => f.id === folder.id)?.groups.find(g => g.id === group.id);
    const field = groupObj?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const existingConfig = field.config || {};
    const cols = existingConfig.cols || ['选项1', '选项2', '选项3'];
    
    if (cols.length <= 1) {
      message.warning('至少保留一个选项');
      return;
    }

    const newCols = cols.filter((_, idx) => idx !== colIdx);

    designData.updateField(folder.id, group.id, fieldId, {
      config: { 
        ...existingConfig, 
        rows: existingConfig.rows || ['题目1', '题目2'],
        cols: newCols
      }
    });
    message.success('选项已删除');
  }, [data, designData, selectionPath]);

  // 处理添加矩阵列（选项）
  const handleAddMatrixCol = useCallback((fieldId) => {
    const folder = selectionPath.find(i => i.type === 'folder');
    const group = selectionPath.find(i => i.type === 'group');

    if (!folder || !group) return;

    const groupObj = data.folders.find(f => f.id === folder.id)?.groups.find(g => g.id === group.id);
    const field = groupObj?.fields.find(f => f.id === fieldId);
    if (!field) return;

    // 使用与渲染一致的默认值
    const existingConfig = field.config || {};
    const config = {
      rows: existingConfig.rows || ['题目1', '题目2'],
      cols: existingConfig.cols || ['选项1', '选项2', '选项3']
    };
    
    // 添加新选项
    const newColIndex = config.cols.length + 1;
    config.cols = [...config.cols, `选项${newColIndex}`];

    designData.updateField(folder.id, group.id, fieldId, {
      config: { ...config }
    });
    message.success('选项已添加');
  }, [data, designData, selectionPath]);

  // 处理矩阵配置修改（题目或选项编辑）
  const handleMatrixConfigChange = useCallback((folderId, groupId, fieldId, newConfig) => {
    if (!folderId || !groupId || !fieldId) return;

    designData.updateField(folderId, groupId, fieldId, {
      config: newConfig
    });
  }, [designData]);

  // 处理表格子字段名称修改
  const handleTableChildNameChange = useCallback((folderId, groupId, fieldId, childIndex, newName) => {
    if (!folderId || !groupId || !fieldId) return;

    const folder = data.folders.find(f => f.id === folderId);
    const group = folder?.groups.find(g => g.id === groupId);
    const field = group?.fields.find(f => f.id === fieldId);
    if (!field) return;

    const children = [...(field.children || [])];
    if (children[childIndex]) {
      const childId = children[childIndex].id;
      children[childIndex] = {
        ...children[childIndex],
        name: newName,
        displayName: newName
      };

      designData.updateField(folderId, groupId, fieldId, {
        children: children
      });
      if (childId) {
        syncSelectionPathName('child', childId, newName);
      }
    }
  }, [data, designData, syncSelectionPathName]);

  // 返回
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  }, [navigate, onBack]);

  return (
    <div className="form-designer">
      {/* 主内容区 - 直接显示设计视图，无需切换标签 */}
      <div className="main-content">
        <div className="design-view">
          <ResizablePanels
            defaultLeftWidth={240}
            defaultRightWidth={360}
            minLeftWidth={200}
            maxLeftWidth={400}
            minRightWidth={300}
            maxRightWidth={500}
            leftPanel={
              <Tabs
                activeKey={leftPanelTab}
                onChange={setLeftPanelTab}
                tabPosition="top"
                size="small"
                className="left-panel-tabs"
              >
                <TabPane tab="目录" key="structure">
                  <FolderTree
                    folders={data.folders}
                    version={designData.version}
                    selectedFolderId={selectedFolderId}
                    selectedGroupId={selectedGroupId}
                    onSelect={handleTreeSelect}
                    onAddFolder={!readonly ? handleAddFolder : null}
                    onAddGroup={!readonly ? handleAddGroup : null}
                    onEditFolder={!readonly ? handleEditFolder : null}
                    onCopyFolder={!readonly ? handleCopyFolder : null}
                    onDeleteFolder={!readonly ? handleDeleteFolder : null}
                    onEditGroupName={!readonly ? handleEditGroupName : null}
                    onDeleteGroup={!readonly ? handleDeleteGroup : null}
                    onReorderFolders={!readonly ? designData.reorderFolders : null}
                    onReorderGroups={!readonly ? designData.reorderGroups : null}
                    onMoveGroup={!readonly ? designData.moveGroup : null}
                    readonly={readonly}
                  />
                </TabPane>
                <TabPane tab="组件库" key="components">
                  <ComponentLibrary
                    draggable={!readonly}
                    onDragStart={() => {}}
                  />
                </TabPane>
              </Tabs>
            }
            centerPanel={
              <DesignCanvas
                folders={data.folders}
                version={designData.version}
                selectedFolderId={selectedFolderId}
                selectedGroupId={selectedGroupId}
                selectedFieldId={selectedFieldId}
                selectionPath={selectionPath}
                onSelect={handleCanvasSelect}
                onAddField={handleAddField}
                onAddGroup={!readonly ? handleAddGroup : null}
                onAddFolder={!readonly ? handleAddFolder : null}
                onEditField={handleEditField}
                onDeleteField={handleDeleteField}
                onCopyField={handleCopyField}
                onFieldReorder={!readonly ? handleFieldReorder : null}
                onFieldNameChange={!readonly ? handleFieldNameChange : null}
                onOptionsChange={!readonly ? handleOptionsChange : null}
                onGroupNameChange={!readonly ? handleGroupNameChange : null}
                onChildSelect={!readonly ? handleChildSelect : null}
                onAddTableChild={!readonly ? handleAddTableChild : null}
                onAddTableRow={!readonly ? handleAddTableRow : null}
                onEditRowPrefix={!readonly ? handleEditRowPrefix : null}
                onAddMatrixRow={!readonly ? handleAddMatrixRow : null}
                onAddMatrixCol={!readonly ? handleAddMatrixCol : null}
                onDeleteMatrixRow={!readonly ? handleDeleteMatrixRow : null}
                onCopyMatrixRow={!readonly ? handleCopyMatrixRow : null}
                onDeleteMatrixCol={!readonly ? handleDeleteMatrixCol : null}
                onDeleteTableChild={!readonly ? handleDeleteTableChild : null}
                onReorderTableChildren={!readonly ? handleReorderTableChildren : null}
                onMatrixConfigChange={!readonly ? handleMatrixConfigChange : null}
                onTableChildNameChange={!readonly ? handleTableChildNameChange : null}
                onDrop={!readonly ? handleDropField : null}
                onLoadExample={!readonly ? handleLoadExample : null}
                onApplyTemplate={!readonly ? handleApplyTemplate : null}
                readonly={readonly}
              />
            }
            rightPanel={
              <Tabs
                activeKey={rightPanelTab}
                onChange={setRightPanelTab}
                tabPosition="top"
                size="small"
                className="right-panel-tabs"
              >
                <TabPane tab="表单配置" key="form">
                  <FormConfigPanel
                    folder={selectedObjects.folder}
                    group={selectedObjects.group}
                    onUpdate={handleUpdateGroup}
                    readonly={readonly}
                    docTypeOptions={docTypeOptions}
                    version={designData.version}
                  />
                </TabPane>
                <TabPane tab="字段配置" key="field" disabled={!selectedObjects.field}>
                  <FieldConfigPanel
                    field={selectedObjects.field}
                    onUpdate={handleUpdateField}
                    readonly={readonly}
                    version={designData.version}
                  />
                </TabPane>
              </Tabs>
            }
          />
        </div>
      </div>

      {/* 字段编辑弹窗 */}
      <FieldModal
        visible={fieldModalVisible}
        field={editingField}
        mode={editingField?.id ? 'edit' : 'create'}
        onCancel={() => {
          setFieldModalVisible(false);
          setEditingField(null);
        }}
        onOk={handleSaveField}
      />

      {/* 预览弹窗 */}
      <PreviewModal
        visible={previewVisible}
        data={data}
        onCancel={() => setPreviewVisible(false)}
      />
    </div>
  );
});

FormDesigner.displayName = 'FormDesigner';

export default FormDesigner;
