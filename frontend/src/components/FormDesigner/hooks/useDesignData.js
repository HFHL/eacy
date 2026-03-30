/**
 * useDesignData Hook
 * 用于管理设计器的数据状态
 */

import { useState, useCallback, useRef } from 'react';
import DesignModel from '../core/DesignModel';
import { schemaValidator } from '../core/validators';

/**
 * 设计数据管理Hook
 * @param {Object} initialData - 初始数据
 * @returns {Object} Hook返回值
 */
export const useDesignData = (initialData = null) => {
  // 使用ref保持模型实例的稳定性
  const modelRef = useRef(
    new DesignModel(
      initialData || {
        meta: {
          $schema: 'https://json-schema.org/draft/2020-12/schema',
          $id: 'crf-template',
          title: 'CRF模版',
          version: '1.0.0',
          projectId: 'demo',
          createdAt: new Date().toISOString()
        },
        folders: [],
        enums: {}
      }
    )
  );

  // 状态触发器
  const [version, setVersion] = useState(0);
  const [selectedItem, setSelectedItem] = useState({
    folderId: null,
    groupId: null,
    fieldId: null
  });

  /**
   * 触发更新
   */
  const notifyUpdate = useCallback(() => {
    setVersion(v => v + 1);
  }, []);

  /**
   * 获取当前数据
   */
  const getData = useCallback(() => {
    return modelRef.current.getData();
  }, []);

  /**
   * 更新元信息
   */
  const updateMeta = useCallback((updates) => {
    modelRef.current.updateMeta(updates);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 添加文件夹
   */
  const addFolder = useCallback((folderData) => {
    const folder = modelRef.current.addFolder(folderData);
    notifyUpdate();
    return folder;
  }, [notifyUpdate]);

  /**
   * 更新文件夹
   */
  const updateFolder = useCallback((folderId, updates) => {
    modelRef.current.updateFolder(folderId, updates);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 删除文件夹
   */
  const deleteFolder = useCallback((folderId) => {
    modelRef.current.deleteFolder(folderId);

    // 如果删除的是当前选中的文件夹，清除选中状态
    if (selectedItem.folderId === folderId) {
      setSelectedItem({ folderId: null, groupId: null, fieldId: null });
    }

    notifyUpdate();
  }, [selectedItem, notifyUpdate]);

  /**
   * 添加字段组
   */
  const addGroup = useCallback((folderId, groupData) => {
    const group = modelRef.current.addGroup(folderId, groupData);
    notifyUpdate();
    return group;
  }, [notifyUpdate]);

  /**
   * 更新字段组
   */
  const updateGroup = useCallback((folderId, groupId, updates) => {
    modelRef.current.updateGroup(folderId, groupId, updates);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 删除字段组
   */
  const deleteGroup = useCallback((folderId, groupId) => {
    modelRef.current.deleteGroup(folderId, groupId);

    // 如果删除的是当前选中的字段组，清除选中状态
    if (selectedItem.groupId === groupId) {
      setSelectedItem({
        folderId: selectedItem.folderId,
        groupId: null,
        fieldId: null
      });
    }

    notifyUpdate();
  }, [selectedItem, notifyUpdate]);

  /**
   * 重新排序文件夹（分组）
   */
  const reorderFolders = useCallback((newOrderIds) => {
    modelRef.current.reorderFolders(newOrderIds);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 重新排序表单（字段组）
   */
  const reorderGroups = useCallback((folderId, newOrderIds) => {
    modelRef.current.reorderGroups(folderId, newOrderIds);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 移动表单到另一个文件夹
   */
  const moveGroup = useCallback((sourceFolderId, groupId, targetFolderId, targetIndex = -1) => {
    modelRef.current.moveGroup(sourceFolderId, groupId, targetFolderId, targetIndex);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 添加字段
   */
  const addField = useCallback((folderId, groupId, fieldData) => {
    const field = modelRef.current.addField(folderId, groupId, fieldData);
    notifyUpdate();
    return field;
  }, [notifyUpdate]);

  /**
   * 更新字段
   */
  const updateField = useCallback((folderId, groupId, fieldId, updates) => {
    modelRef.current.updateField(folderId, groupId, fieldId, updates);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 删除字段
   */
  const deleteField = useCallback((folderId, groupId, fieldId) => {
    modelRef.current.deleteField(folderId, groupId, fieldId);

    // 如果删除的是当前选中的字段，清除选中状态
    if (selectedItem.fieldId === fieldId) {
      setSelectedItem({
        folderId: selectedItem.folderId,
        groupId: selectedItem.groupId,
        fieldId: null
      });
    }

    notifyUpdate();
  }, [selectedItem, notifyUpdate]);

  /**
   * 移动字段
   */
  const moveField = useCallback((folderId, groupId, fieldId, direction) => {
    modelRef.current.moveField(folderId, groupId, fieldId, direction);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 复制字段
   */
  const duplicateField = useCallback((folderId, groupId, fieldId) => {
    const field = modelRef.current.duplicateField(folderId, groupId, fieldId);
    notifyUpdate();
    return field;
  }, [notifyUpdate]);

  /**
   * 批量添加字段
   */
  const batchAddFields = useCallback((folderId, groupId, fieldsData) => {
    const addedFields = [];
    for (const fieldData of fieldsData) {
      const field = modelRef.current.addField(folderId, groupId, fieldData);
      if (field) {
        addedFields.push(field);
      }
    }
    notifyUpdate();
    return addedFields;
  }, [notifyUpdate]);

  /**
   * 添加子字段
   */
  const addChildField = useCallback((folderId, groupId, fieldId, childFieldData) => {
    const childField = modelRef.current.addChildField(folderId, groupId, fieldId, childFieldData);
    notifyUpdate();
    return childField;
  }, [notifyUpdate]);

  /**
   * 更新子字段
   */
  const updateChildField = useCallback((folderId, groupId, fieldId, childFieldId, updates) => {
    modelRef.current.updateChildField(folderId, groupId, fieldId, childFieldId, updates);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 删除子字段
   */
  const deleteChildField = useCallback((folderId, groupId, fieldId, childFieldId) => {
    modelRef.current.deleteChildField(folderId, groupId, fieldId, childFieldId);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 设置选中项
   */
  const setSelection = useCallback((selection) => {
    modelRef.current.setSelection(selection);
    setSelectedItem(selection);
  }, []);

  /**
   * 清除选中项
   */
  const clearSelection = useCallback(() => {
    modelRef.current.clearSelection();
    setSelectedItem({ folderId: null, groupId: null, fieldId: null });
  }, []);

  /**
   * 展开/折叠
   */
  const toggleFolderExpanded = useCallback((folderId) => {
    modelRef.current.toggleFolderExpanded(folderId);
    notifyUpdate();
  }, [notifyUpdate]);

  const toggleGroupExpanded = useCallback((groupId) => {
    modelRef.current.toggleGroupExpanded(groupId);
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 搜索字段
   */
  const searchFields = useCallback((keyword) => {
    return modelRef.current.searchFields(keyword);
  }, []);

  /**
   * 获取统计信息
   */
  const getStatistics = useCallback(() => {
    return modelRef.current.getStatistics();
  }, []);

  /**
   * 验证当前设计
   */
  const validateDesign = useCallback(() => {
    const data = modelRef.current.getData();
    return schemaValidator.validateDesignModel(data);
  }, []);

  /**
   * 重置数据
   */
  const resetData = useCallback((newData) => {
    modelRef.current = new DesignModel(newData);
    setSelectedItem({ folderId: null, groupId: null, fieldId: null });
    notifyUpdate();
  }, [notifyUpdate]);

  /**
   * 获取选中的完整对象
   */
  const getSelectedObjects = useCallback(() => {
    const data = modelRef.current.getData();
    const result = {
      folder: null,
      group: null,
      field: null
    };

    if (selectedItem.folderId) {
      result.folder = data.folders.find(f => f.id === selectedItem.folderId);
    }
    if (selectedItem.groupId && result.folder) {
      result.group = result.folder.groups.find(g => g.id === selectedItem.groupId);
    }
    if (selectedItem.fieldId && result.group) {
      result.field = result.group.fields.find(f => f.id === selectedItem.fieldId);
    }

    return result;
  }, [selectedItem]);

  return {
    // 数据访问
    getData,
    getSelectedObjects,
    getStatistics,
    version, // 暴露版本号用于强制更新

    // 元信息操作
    updateMeta,

    // 文件夹操作
    addFolder,
    updateFolder,
    deleteFolder,

    // 字段组操作
    addGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    moveGroup,

    // 文件夹排序
    reorderFolders,

    // 字段操作
    addField,
    updateField,
    deleteField,
    moveField,
    duplicateField,
    batchAddFields,
    addChildField,
    updateChildField,
    deleteChildField,

    // 选中状态
    setSelection,
    clearSelection,
    selectedItem,

    // 展开/折叠
    toggleFolderExpanded,
    toggleGroupExpanded,

    // 工具方法
    searchFields,
    validateDesign,
    resetData
  };
};

export default useDesignData;
