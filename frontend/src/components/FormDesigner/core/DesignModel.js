/**
 * 设计器数据模型
 * 用于管理设计器的内部状态和数据结构
 */

import { DISPLAY_TYPES, DEFAULT_CONFIG, FIELD_CATEGORIES } from './constants';

/**
 * 设计器数据模型类
 */
export class DesignModel {
  constructor(initialData = null) {
    this.data = this._createEmptyModel();
    if (initialData) {
      this._loadFromData(initialData);
    }
  }

  /**
   * 创建空的数据模型
   */
  _createEmptyModel() {
    return {
      meta: {
        $id: 'untitled.schema.json',
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        version: '1.0.0',
        projectId: '',
        created: null,
        modified: new Date().toISOString(),
        author: '',
        description: ''
      },
      folders: [],
      enums: {},
      selectedFolderId: null,
      selectedGroupId: null,
      selectedFieldId: null,
      expandedFolderIds: [],
      expandedGroupIds: []
    };
  }

  _generateFieldUid() {
    return `f_${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * 从数据加载
   */
  _loadFromData(data) {
    this.data = {
      ...this.data,
      ...data,
      meta: { ...this.data.meta, ...data.meta }
    };
  }

  /**
   * 获取完整数据
   */
  getData() {
    return this.data;
  }

  /**
   * 获取元信息
   */
  getMeta() {
    return this.data.meta;
  }

  /**
   * 更新元信息
   */
  updateMeta(updates) {
    this.data.meta = {
      ...this.data.meta,
      ...updates,
      modified: new Date().toISOString()
    };
  }

  /**
   * 获取所有文件夹
   */
  getFolders() {
    return this.data.folders;
  }

  /**
   * 添加文件夹
   */
  addFolder(folderData) {
    const newFolder = {
      id: this._generateId('folder'),
      name: folderData.name || '新文件夹',
      groups: [],
      ...folderData
    };
    this.data.folders.push(newFolder);
    return newFolder;
  }

  /**
   * 更新文件夹
   */
  updateFolder(folderId, updates) {
    const folder = this._findFolder(folderId);
    if (folder) {
      Object.assign(folder, updates);
    }
    return folder;
  }

  /**
   * 删除文件夹
   */
  deleteFolder(folderId) {
    const index = this.data.folders.findIndex(f => f.id === folderId);
    if (index !== -1) {
      this.data.folders.splice(index, 1);
      this.data.folders.forEach((f, idx) => { f.order = idx; });
    }
  }

  /**
   * 获取文件夹
   */
  getFolder(folderId) {
    return this._findFolder(folderId);
  }

  /**
   * 添加字段组
   */
  addGroup(folderId, groupData) {
    const folder = this._findFolder(folderId);
    if (!folder) return null;

    const newGroup = {
      id: this._generateId('group'),
      uid: null,
      name: groupData.name || '新字段组',
      type: DISPLAY_TYPES.GROUP,
      displayName: groupData.name || '新字段组',
      repeatable: DEFAULT_CONFIG.group.repeatable,
      isExtractionUnit: DEFAULT_CONFIG.group.isExtractionUnit,
      mergeBinding: null,
      sources: null,
      fields: [],
      config: {},
      ...groupData
    };

    folder.groups.push(newGroup);
    return newGroup;
  }

  /**
   * 更新字段组
   */
  updateGroup(folderId, groupId, updates) {
    const group = this._findGroup(folderId, groupId);
    if (group) {
      Object.assign(group, updates);
      // 当字段列表被替换时（拖拽排序），同步每个字段的 order 属性
      if (updates.fields && Array.isArray(updates.fields)) {
        group.fields.forEach((field, idx) => {
          field.order = idx;
        });
      }
    }
    return group;
  }

  /**
   * 删除字段组
   */
  deleteGroup(folderId, groupId) {
    const folder = this._findFolder(folderId);
    if (!folder) return;

    const index = folder.groups.findIndex(g => g.id === groupId);
    if (index !== -1) {
      folder.groups.splice(index, 1);
      folder.groups.forEach((g, idx) => { g.order = idx; });
    }
  }

  /**
   * 获取字段组
   */
  getGroup(folderId, groupId) {
    return this._findGroup(folderId, groupId);
  }

  /**
   * 添加字段
   */
  addField(folderId, groupId, fieldData) {
    const group = this._findGroup(folderId, groupId);
    if (!group) return null;

    const uid = fieldData.uid || fieldData.fieldUid || this._generateFieldUid();
    const newField = {
      id: this._generateId('field'),
      uid,
      fieldId: fieldData.fieldId || uid,
      name: fieldData.name || '新字段',
      displayName: fieldData.name || '新字段',
      displayType: fieldData.displayType || DISPLAY_TYPES.TEXT,
      dataType: this._inferDataType(fieldData.displayType),
      options: fieldData.options || null,
      optionsId: fieldData.optionsId || null,
      unit: fieldData.unit || null,
      nullable: DEFAULT_CONFIG.field.nullable,
      sensitive: DEFAULT_CONFIG.field.sensitive,
      primary: DEFAULT_CONFIG.field.primary,
      editable: DEFAULT_CONFIG.field.editable,
      description: fieldData.description || '',
      extractionPrompt: fieldData.extractionPrompt || '',
      conflictPolicy: fieldData.conflictPolicy || null,
      warnOnConflict: fieldData.warnOnConflict !== false,
      required: false,
      format: fieldData.format || null,
      defaultValue: null,
      children: null,
      config: fieldData.config || null,
      formTemplate: fieldData.formTemplate || null,
      fileType: fieldData.fileType || null,
      category: fieldData.category || FIELD_CATEGORIES.SINGLE,
      ...fieldData
    };

    newField.order = group.fields.length;
    group.fields.push(newField);
    return newField;
  }

  /**
   * 更新字段
   */
  updateField(folderId, groupId, fieldId, updates) {
    const group = this._findGroup(folderId, groupId);
    if (!group) return null;

    const fieldIndex = group.fields.findIndex(f => f.id === fieldId);
    if (fieldIndex === -1) return null;

    const field = group.fields[fieldIndex];

    // 如果更新了displayType，自动更新dataType
    if (updates.displayType && updates.displayType !== field.displayType) {
      updates.dataType = this._inferDataType(updates.displayType);
    }

    // 创建新的字段对象引用，确保 React 能检测到变化
    const updatedField = { ...field, ...updates };
    group.fields[fieldIndex] = updatedField;

    return updatedField;
  }

  /**
   * 删除字段
   */
  deleteField(folderId, groupId, fieldId) {
    const group = this._findGroup(folderId, groupId);
    if (!group) return;

    const index = group.fields.findIndex(f => f.id === fieldId);
    if (index !== -1) {
      group.fields.splice(index, 1);
      // 重新同步 order
      group.fields.forEach((f, idx) => { f.order = idx; });
    }
  }

  /**
   * 移动字段
   */
  moveField(folderId, groupId, fieldId, direction) {
    const group = this._findGroup(folderId, groupId);
    if (!group) return;

    const index = group.fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= group.fields.length) return;

    const [field] = group.fields.splice(index, 1);
    group.fields.splice(newIndex, 0, field);
    // 同步 order
    group.fields.forEach((f, idx) => { f.order = idx; });
  }

  /**
   * 复制字段
   */
  duplicateField(folderId, groupId, fieldId) {
    const field = this._findField(folderId, groupId, fieldId);
    if (!field) return null;

    const duplicatedField = {
      ...field,
      id: this._generateId('field'),
      uid: null, // 复制时生成新UID
      name: `${field.name}_副本`,
      displayName: `${field.displayName}_副本`
    };

    const group = this._findGroup(folderId, groupId);
    const index = group.fields.findIndex(f => f.id === fieldId);
    group.fields.splice(index + 1, 0, duplicatedField);

    return duplicatedField;
  }

  /**
   * 添加子字段（用于表格、矩阵等嵌套组件）
   */
  addChildField(folderId, groupId, fieldId, childFieldData) {
    const field = this._findField(folderId, groupId, fieldId);
    if (!field) return null;

    // 确保 field.children 存在
    if (!field.children) {
      field.children = [];
    }

    const newChildField = {
      id: this._generateId('child'),
      uid: childFieldData.uid || null,
      name: childFieldData.name || '新子字段',
      displayName: childFieldData.name || '新子字段',
      displayType: childFieldData.displayType || DISPLAY_TYPES.TEXT,
      dataType: this._inferDataType(childFieldData.displayType),
      options: childFieldData.options || null,
      unit: childFieldData.unit || null,
      nullable: DEFAULT_CONFIG.field.nullable,
      required: false,
      description: childFieldData.description || '',
      ...childFieldData
    };

    field.children.push(newChildField);
    return newChildField;
  }

  /**
   * 更新子字段
   */
  updateChildField(folderId, groupId, fieldId, childFieldId, updates) {
    const field = this._findField(folderId, groupId, fieldId);
    if (!field || !field.children) return null;

    const childIndex = field.children.findIndex(f => f.id === childFieldId);
    if (childIndex === -1) return null;
    const childField = field.children[childIndex];

    // 如果更新了displayType，自动更新dataType
    if (updates.displayType && updates.displayType !== childField.displayType) {
      updates.dataType = this._inferDataType(updates.displayType);
    }

    const updatedChildField = { ...childField, ...updates };
    const nextChildren = [...field.children];
    nextChildren[childIndex] = updatedChildField;
    field.children = nextChildren;
    return updatedChildField;
  }

  /**
   * 删除子字段
   */
  deleteChildField(folderId, groupId, fieldId, childFieldId) {
    const field = this._findField(folderId, groupId, fieldId);
    if (!field || !field.children) return;

    const index = field.children.findIndex(f => f.id === childFieldId);
    if (index !== -1) {
      field.children.splice(index, 1);
    }
  }

  /**
   * 获取子字段
   */
  getChildField(folderId, groupId, fieldId, childFieldId) {
    const field = this._findField(folderId, groupId, fieldId);
    if (!field || !field.children) return null;

    return field.children.find(f => f.id === childFieldId);
  }

  /**
   * 获取字段
   */
  getField(folderId, groupId, fieldId) {
    return this._findField(folderId, groupId, fieldId);
  }

  /**
   * 获取选中的项
   */
  getSelection() {
    return {
      folderId: this.data.selectedFolderId,
      groupId: this.data.selectedGroupId,
      fieldId: this.data.selectedFieldId
    };
  }

  /**
   * 设置选中项
   */
  setSelection({ folderId, groupId, fieldId }) {
    if (folderId !== undefined) this.data.selectedFolderId = folderId;
    if (groupId !== undefined) this.data.selectedGroupId = groupId;
    if (fieldId !== undefined) this.data.selectedFieldId = fieldId;
  }

  /**
   * 清除选中项
   */
  clearSelection() {
    this.data.selectedFolderId = null;
    this.data.selectedGroupId = null;
    this.data.selectedFieldId = null;
  }

  /**
   * 展开/折叠文件夹
   */
  toggleFolderExpanded(folderId) {
    const index = this.data.expandedFolderIds.indexOf(folderId);
    if (index !== -1) {
      this.data.expandedFolderIds.splice(index, 1);
    } else {
      this.data.expandedFolderIds.push(folderId);
    }
  }

  /**
   * 展开/折叠字段组
   */
  toggleGroupExpanded(groupId) {
    const index = this.data.expandedGroupIds.indexOf(groupId);
    if (index !== -1) {
      this.data.expandedGroupIds.splice(index, 1);
    } else {
      this.data.expandedGroupIds.push(groupId);
    }
  }

  /**
   * 设置展开的文件夹
   */
  setExpandedFolders(folderIds) {
    this.data.expandedFolderIds = [...folderIds];
  }

  /**
   * 设置展开的字段组
   */
  setExpandedGroups(groupIds) {
    this.data.expandedGroupIds = [...groupIds];
  }

  /**
   * 搜索字段
   */
  searchFields(keyword) {
    const results = [];
    if (!keyword || keyword.trim() === '') return results;

    const lowerKeyword = keyword.toLowerCase();

    for (const folder of this.data.folders) {
      for (const group of folder.groups) {
        for (const field of group.fields) {
          if (
            field.name.toLowerCase().includes(lowerKeyword) ||
            field.displayName.toLowerCase().includes(lowerKeyword) ||
            (field.description && field.description.toLowerCase().includes(lowerKeyword))
          ) {
            results.push({
              field,
              folderName: folder.name,
              groupName: group.name,
              folderId: folder.id,
              groupId: group.id,
              path: `${folder.name} > ${group.name} > ${field.name}`
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * 重新排序文件夹（分组）
   * @param {Array<string>} newOrderIds - 新的文件夹 ID 顺序
   */
  reorderFolders(newOrderIds) {
    const newFolders = [];
    for (const id of newOrderIds) {
      const folder = this._findFolder(id);
      if (folder) {
        newFolders.push(folder);
      }
    }
    // 保留任何不在 newOrderIds 中的文件夹（防止意外丢失）
    for (const folder of this.data.folders) {
      if (!newOrderIds.includes(folder.id)) {
        newFolders.push(folder);
      }
    }
    this.data.folders = newFolders;
    // 同步 order 属性与数组位置
    this.data.folders.forEach((folder, idx) => {
      folder.order = idx;
    });
  }

  /**
   * 重新排序表单（字段组）
   * @param {string} folderId - 文件夹 ID
   * @param {Array<string>} newOrderIds - 新的表单 ID 顺序
   */
  reorderGroups(folderId, newOrderIds) {
    const folder = this._findFolder(folderId);
    if (!folder) return;

    const newGroups = [];
    for (const id of newOrderIds) {
      const group = folder.groups.find(g => g.id === id);
      if (group) {
        newGroups.push(group);
      }
    }
    // 保留任何不在 newOrderIds 中的表单
    for (const group of folder.groups) {
      if (!newOrderIds.includes(group.id)) {
        newGroups.push(group);
      }
    }
    folder.groups = newGroups;
    // 同步 order 属性与数组位置
    folder.groups.forEach((group, idx) => {
      group.order = idx;
    });
  }

  /**
   * 移动表单到另一个文件夹
   * @param {string} sourceFolderId - 源文件夹 ID
   * @param {string} groupId - 表单 ID
   * @param {string} targetFolderId - 目标文件夹 ID
   * @param {number} targetIndex - 目标位置索引（可选）
   */
  moveGroup(sourceFolderId, groupId, targetFolderId, targetIndex = -1) {
    const sourceFolder = this._findFolder(sourceFolderId);
    const targetFolder = this._findFolder(targetFolderId);
    if (!sourceFolder || !targetFolder) return;

    const groupIndex = sourceFolder.groups.findIndex(g => g.id === groupId);
    if (groupIndex === -1) return;

    // 从源文件夹中移除
    const [group] = sourceFolder.groups.splice(groupIndex, 1);

    // 添加到目标文件夹
    if (targetIndex >= 0 && targetIndex <= targetFolder.groups.length) {
      targetFolder.groups.splice(targetIndex, 0, group);
    } else {
      targetFolder.groups.push(group);
    }

    // 同步两个文件夹内的 order 属性
    sourceFolder.groups.forEach((g, idx) => { g.order = idx; });
    targetFolder.groups.forEach((g, idx) => { g.order = idx; });
  }

  /**
   * 获取统计信息
   */
  getStatistics() {
    let totalGroups = 0;
    let totalFields = 0;
    let totalEnums = 0;

    for (const folder of this.data.folders) {
      totalGroups += folder.groups.length;
      for (const group of folder.groups) {
        totalFields += group.fields.length;
        // 统计枚举类型字段
        for (const field of group.fields) {
          if (field.options && field.options.length > 0) {
            totalEnums++;
          }
        }
      }
    }

    return {
      totalFolders: this.data.folders.length,
      totalGroups,
      totalFields,
      totalEnums
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 查找文件夹
   */
  _findFolder(folderId) {
    return this.data.folders.find(f => f.id === folderId);
  }

  /**
   * 查找字段组
   */
  _findGroup(folderId, groupId) {
    const folder = this._findFolder(folderId);
    return folder?.groups.find(g => g.id === groupId);
  }

  /**
   * 查找字段
   */
  _findField(folderId, groupId, fieldId) {
    const group = this._findGroup(folderId, groupId);
    return group?.fields.find(f => f.id === fieldId);
  }

  /**
   * 生成ID
   */
  _generateId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 推断数据类型
   */
  _inferDataType(displayType) {
    const typeMap = {
      [DISPLAY_TYPES.NUMBER]: 'number',
      [DISPLAY_TYPES.CHECKBOX]: 'array',
      [DISPLAY_TYPES.MULTISELECT]: 'array',
      [DISPLAY_TYPES.DATE]: 'string'
    };
    return typeMap[displayType] || 'string';
  }
}

export default DesignModel;
