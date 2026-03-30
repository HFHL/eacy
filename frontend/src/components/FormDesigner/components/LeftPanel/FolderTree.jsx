/**
 * FolderTree - 文件夹树形组件
 * 左侧面板：显示Schema的文件夹（访视）层级结构
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Tree, Empty, Tag, Button, Dropdown, Tooltip, Input, message } from 'antd';
import { 
  FolderOutlined, 
  FolderOpenOutlined, 
  FormOutlined, 
  PlusOutlined,
  MoreOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  AppstoreAddOutlined
} from '@ant-design/icons';

/**
 * 文件夹树组件
 */
const FolderTree = ({
  folders = [],
  selectedFolderId = null,
  selectedGroupId = null,
  onSelect = null,
  onDrop = null,
  onAddFolder = null,
  onAddGroup = null,
  onEditFolder = null,
  onCopyFolder = null,
  onDeleteFolder = null,
  onEditGroupName = null,
  onDeleteGroup = null,
  onBatchAddGroups = null,
  onReorderFolders = null,
  onReorderGroups = null,
  onMoveGroup = null,
  readonly = false,
  version = 0 // 接收版本号
}) => {
  // 悬停的文件夹ID
  const [hoveredFolderId, setHoveredFolderId] = useState(null);
  // 悬停的表单ID
  const [hoveredGroupKey, setHoveredGroupKey] = useState(null);
  // 正在编辑的表单ID
  const [editingGroupKey, setEditingGroupKey] = useState(null);
  // 正在编辑的文件夹ID
  const [editingFolderId, setEditingFolderId] = useState(null);
  // 编辑中的名称
  const [editingName, setEditingName] = useState('');
  
  // 激活的下拉菜单（文件夹ID或表单KEY）
  const [activeDropdownFolderId, setActiveDropdownFolderId] = useState(null);
  const [activeDropdownGroupKey, setActiveDropdownGroupKey] = useState(null);
  
  // 输入框引用
  const inputRef = useRef(null);
  const folderInputRef = useRef(null);
  // 中文输入法组合状态
  const isComposingRef = useRef(false);

  // 当开始编辑表单时，聚焦输入框
  useEffect(() => {
    if (editingGroupKey && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingGroupKey]);

  // 当开始编辑文件夹时，聚焦输入框
  useEffect(() => {
    if (editingFolderId && folderInputRef.current) {
      folderInputRef.current.focus();
      folderInputRef.current.select();
    }
  }, [editingFolderId]);

  // 检查文件夹是否需要自动进入编辑模式（新建的文件夹）
  useEffect(() => {
    folders.forEach(folder => {
      if (folder.isNew && selectedFolderId === folder.id) {
        setEditingFolderId(folder.id);
        setEditingName(folder.name);
      }
    });
  }, [folders, selectedFolderId]);

  // 检查表单是否需要自动进入编辑模式（新建的表单）
  useEffect(() => {
    folders.forEach(folder => {
      (folder.groups || []).forEach(group => {
        if (group.isNew && selectedGroupId === group.id) {
          const key = `group-${folder.id}-${group.id}`;
          setEditingGroupKey(key);
          setEditingName(group.name);
        }
      });
    });
  }, [folders, selectedGroupId]);

  // 处理添加表单
  const handleAddGroup = (e, folderId) => {
    e.stopPropagation();
    if (onAddGroup) {
      onAddGroup(folderId);
    }
  };

  // 开始编辑文件夹名称
  const startEditingFolder = (folderId, currentName) => {
    setEditingFolderId(folderId);
    setEditingName(currentName);
  };

  // 完成编辑文件夹名称
  const finishEditingFolder = (folderId) => {
    if (editingName && editingName.trim()) {
      if (onEditFolder) {
        onEditFolder(folderId, editingName.trim());
      }
    }
    setEditingFolderId(null);
    setEditingName('');
  };

  // 开始编辑表单名称
  const startEditingGroup = (folderId, groupId, currentName) => {
    const key = `group-${folderId}-${groupId}`;
    setEditingGroupKey(key);
    setEditingName(currentName);
  };

  // 完成编辑表单名称
  const finishEditingGroup = (folderId, groupId) => {
    if (editingName && editingName.trim()) {
      if (onEditGroupName) {
        onEditGroupName(folderId, groupId, editingName.trim());
      }
    }
    setEditingGroupKey(null);
    setEditingName('');
  };

  // 取消编辑
  const cancelEditing = () => {
    setEditingGroupKey(null);
    setEditingFolderId(null);
    setEditingName('');
  };

  // 处理文件夹操作菜单
  const getFolderMenuItems = (folderId, folderName) => [
    {
      key: 'batchAdd',
      icon: <AppstoreAddOutlined />,
      label: '批量新建表单',
      onClick: () => {
        if (onBatchAddGroups) {
          onBatchAddGroups(folderId);
        } else {
          message.info('批量新建表单功能开发中');
        }
      }
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '修改名称',
      onClick: () => {
        startEditingFolder(folderId, folderName);
      }
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制',
      onClick: () => {
        if (onCopyFolder) {
          onCopyFolder(folderId);
        }
      }
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => {
        if (onDeleteFolder) {
          onDeleteFolder(folderId);
        }
      }
    }
  ];

  // 处理表单操作菜单
  const getGroupMenuItems = (folderId, groupId, groupName) => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '修改名称',
      onClick: () => {
        startEditingGroup(folderId, groupId, groupName);
      }
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      danger: true,
      onClick: () => {
        if (onDeleteGroup) {
          onDeleteGroup(folderId, groupId);
        }
      }
    }
  ];

  // 渲染文件夹标题（带悬停操作和内联编辑）
  const renderFolderTitle = (folder) => {
    const isHovered = hoveredFolderId === folder.id;
    const isEditing = editingFolderId === folder.id;
    const isDropdownOpen = activeDropdownFolderId === folder.id;

    // 编辑模式
    if (isEditing) {
      return (
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={e => e.stopPropagation()}
        >
          <Input
            ref={folderInputRef}
            size="small"
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onPressEnter={() => { if (!isComposingRef.current) finishEditingFolder(folder.id); }}
            onBlur={() => finishEditingFolder(folder.id)}
            onKeyDown={e => {
              if (isComposingRef.current) return;
              if (e.key === 'Escape') {
                cancelEditing();
              }
            }}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            style={{ width: 140 }}
          />
        </div>
      );
    }
    
    return (
      <div 
        className="folder-title-wrapper"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          width: '100%',
          minWidth: 0, // 允许flex收缩
          paddingRight: 4
        }}
        onMouseEnter={() => setHoveredFolderId(folder.id)}
        onMouseLeave={() => setHoveredFolderId(null)}
      >
        <span style={{ 
          flex: 1, 
          minWidth: 0, // 允许flex收缩
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap' 
        }}>
          {folder.name}
        </span>
        {!readonly && (isHovered || isDropdownOpen) && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4,
              flexShrink: 0,
              marginLeft: 8
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* 更多操作下拉菜单 */}
            <Dropdown
              menu={{ items: getFolderMenuItems(folder.id, folder.name) }}
              trigger={['click']}
              placement="bottomRight"
              onOpenChange={(open) => setActiveDropdownFolderId(open ? folder.id : null)}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                style={{ 
                  padding: '0 4px', 
                  height: 20, 
                  minWidth: 20,
                  color: '#666'
                }}
                onClick={e => e.stopPropagation()}
              />
            </Dropdown>
            {/* 新建表单按钮 */}
            <Tooltip title="新建表单">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                style={{ 
                  padding: '0 4px', 
                  height: 20,
                  minWidth: 20,
                  color: '#1890ff'
                }}
                onClick={(e) => handleAddGroup(e, folder.id)}
              />
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  // 渲染表单标题（支持内联编辑）
  const renderGroupTitle = (folder, group) => {
    const key = `group-${folder.id}-${group.id}`;
    const isHovered = hoveredGroupKey === key;
    const isEditing = editingGroupKey === key;
    const isDropdownOpen = activeDropdownGroupKey === key;

    if (isEditing) {
      return (
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          onClick={e => e.stopPropagation()}
        >
          <Input
            ref={inputRef}
            size="small"
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onPressEnter={() => { if (!isComposingRef.current) finishEditingGroup(folder.id, group.id); }}
            onBlur={() => finishEditingGroup(folder.id, group.id)}
            onKeyDown={e => {
              if (isComposingRef.current) return;
              if (e.key === 'Escape') {
                cancelEditing();
              }
            }}
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
            style={{ width: 120 }}
          />
        </div>
      );
    }

    return (
      <div 
        className="group-title-wrapper"
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          width: '100%',
          minWidth: 0 // 允许flex收缩
        }}
        onMouseEnter={() => setHoveredGroupKey(key)}
        onMouseLeave={() => setHoveredGroupKey(null)}
      >
        <span style={{ 
          flex: 1, 
          minWidth: 0, // 允许flex收缩
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center'
        }}>
          <span style={{ 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap' 
          }}>
            {group.name}
          </span>
          {group.fields && group.fields.length > 0 && (
            <Tag style={{ marginLeft: 4, flexShrink: 0 }} color="blue">{group.fields.length}</Tag>
          )}
        </span>
        {!readonly && (isHovered || isDropdownOpen) && (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center',
              flexShrink: 0,
              marginLeft: 8
            }}
            onClick={e => e.stopPropagation()}
          >
            <Dropdown
              menu={{ items: getGroupMenuItems(folder.id, group.id, group.name) }}
              trigger={['click']}
              placement="bottomRight"
              onOpenChange={(open) => setActiveDropdownGroupKey(open ? key : null)}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreOutlined />}
                style={{ 
                  padding: '0 4px', 
                  height: 20, 
                  minWidth: 20,
                  color: '#666'
                }}
                onClick={e => e.stopPropagation()}
              />
            </Dropdown>
          </div>
        )}
      </div>
    );
  };

  // 转换为树形数据结构
  const treeData = useMemo(() => {
    return folders.map(folder => ({
      key: `folder-${folder.id}`,
      title: renderFolderTitle(folder),
      selectable: true,
      data: { type: 'folder', id: folder.id },
      icon: folder.id === selectedFolderId ? <FolderOpenOutlined /> : <FolderOutlined />,
      children: (folder.groups || []).map(group => ({
        key: `group-${folder.id}-${group.id}`,
        title: renderGroupTitle(folder, group),
        selectable: true,
        data: { type: 'group', folderId: folder.id, id: group.id },
        icon: <FormOutlined />,
        isLeaf: true
      }))
    }));
  }, [folders, selectedFolderId, selectedGroupId, hoveredFolderId, hoveredGroupKey, editingGroupKey, editingFolderId, editingName, readonly, version]);

  // 计算选中的key
  const selectedKeys = useMemo(() => {
    if (selectedGroupId) {
      return [`group-${selectedFolderId}-${selectedGroupId}`];
    }
    if (selectedFolderId) {
      return [`folder-${selectedFolderId}`];
    }
    return [];
  }, [selectedFolderId, selectedGroupId]);

  // 控制展开的节点 - 默认展开所有文件夹，选中的文件夹也要展开
  const [expandedKeys, setExpandedKeys] = useState([]);

  // 初始化时展开所有文件夹
  useEffect(() => {
    const allFolderKeys = folders.map(f => `folder-${f.id}`);
    setExpandedKeys(allFolderKeys);
  }, []);

  // 当选中新的文件夹（比如新建表单时）确保该文件夹展开
  useEffect(() => {
    if (selectedFolderId) {
      const folderKey = `folder-${selectedFolderId}`;
      setExpandedKeys(prev => {
        if (!prev.includes(folderKey)) {
          return [...prev, folderKey];
        }
        return prev;
      });
    }
  }, [selectedFolderId]);

  // 当新建文件夹时，自动展开
  useEffect(() => {
    const allFolderKeys = folders.map(f => `folder-${f.id}`);
    setExpandedKeys(prev => {
      // 找到新增的文件夹key
      const newKeys = allFolderKeys.filter(k => !prev.includes(k));
      if (newKeys.length > 0) {
        return [...prev, ...newKeys];
      }
      return prev;
    });
  }, [folders.length]);

  // 处理展开/收起
  const handleExpand = (keys) => {
    setExpandedKeys(keys);
  };

  // 处理选择事件
  const handleSelect = (selectedKeys, { node }) => {
    if (!onSelect) return;

    const { type, id, folderId } = node.data;

    if (type === 'folder') {
      const folderKey = `folder-${id}`;
      setExpandedKeys(prev => (
        prev.includes(folderKey)
          ? prev.filter(key => key !== folderKey)
          : [...prev, folderKey]
      ));
      onSelect({ folderId: id, groupId: null, fieldId: null });
    } else if (type === 'group') {
      onSelect({ folderId, groupId: id, fieldId: null });
    }
  };

  // 处理拖拽放置
  const handleDrop = (info) => {
    const dragNode = info.dragNode;
    const dropNode = info.node;
    const dropPosition = info.dropPosition;
    const dropToGap = info.dropToGap;

    const dragData = dragNode.data;
    const dropData = dropNode.data;

    // 情况1：拖拽文件夹（分类）
    if (dragData.type === 'folder') {
      if (dropData.type === 'folder') {
        // 文件夹之间排序
        const dragIndex = folders.findIndex(f => f.id === dragData.id);
        let dropIndex = folders.findIndex(f => f.id === dropData.id);
        
        if (dragIndex === -1 || dropIndex === -1) return;
        
        // 计算新位置
        if (!dropToGap) {
          // 放置到节点上，作为第一个
          dropIndex = 0;
        } else if (dropPosition > dropIndex) {
          dropIndex = dropIndex + 1;
        }
        
        // 重新排序
        const newOrder = [...folders];
        const [removed] = newOrder.splice(dragIndex, 1);
        newOrder.splice(dropIndex > dragIndex ? dropIndex - 1 : dropIndex, 0, removed);
        
        if (onReorderFolders) {
          onReorderFolders(newOrder.map(f => f.id));
        }
      }
      // 不允许将文件夹拖到表单上
      return;
    }

    // 情况2：拖拽表单（字段组）
    if (dragData.type === 'group') {
      const sourceFolderId = dragData.folderId;
      const groupId = dragData.id;

      if (dropData.type === 'folder') {
        // 移动到另一个文件夹
        const targetFolderId = dropData.id;
        
        if (sourceFolderId === targetFolderId) {
          // 同一个文件夹内，移到开头
          const folder = folders.find(f => f.id === sourceFolderId);
          if (!folder) return;
          
          const newOrder = folder.groups.filter(g => g.id !== groupId);
          const group = folder.groups.find(g => g.id === groupId);
          if (group) {
            newOrder.unshift(group);
            if (onReorderGroups) {
              onReorderGroups(sourceFolderId, newOrder.map(g => g.id));
            }
          }
        } else {
          // 移动到不同文件夹
          if (onMoveGroup) {
            onMoveGroup(sourceFolderId, groupId, targetFolderId, 0);
          }
        }
        return;
      }

      if (dropData.type === 'group') {
        const targetFolderId = dropData.folderId;
        const targetGroupId = dropData.id;

        if (sourceFolderId === targetFolderId) {
          // 同一个文件夹内重新排序
          const folder = folders.find(f => f.id === sourceFolderId);
          if (!folder) return;

          const dragIndex = folder.groups.findIndex(g => g.id === groupId);
          let dropIndex = folder.groups.findIndex(g => g.id === targetGroupId);
          
          if (dragIndex === -1 || dropIndex === -1) return;
          
          // 根据放置位置调整索引
          if (dropPosition > dropIndex && dropToGap) {
            dropIndex = dropIndex + 1;
          }
          
          const newOrder = [...folder.groups];
          const [removed] = newOrder.splice(dragIndex, 1);
          newOrder.splice(dropIndex > dragIndex ? dropIndex - 1 : dropIndex, 0, removed);
          
          if (onReorderGroups) {
            onReorderGroups(sourceFolderId, newOrder.map(g => g.id));
          }
        } else {
          // 移动到不同文件夹
          const targetFolder = folders.find(f => f.id === targetFolderId);
          if (!targetFolder) return;

          const dropIndex = targetFolder.groups.findIndex(g => g.id === targetGroupId);
          const targetIndex = dropToGap && dropPosition > dropIndex ? dropIndex + 1 : dropIndex;
          
          if (onMoveGroup) {
            onMoveGroup(sourceFolderId, groupId, targetFolderId, targetIndex);
          }
        }
      }
    }
  };

  // 判断是否允许拖拽放置
  const allowDrop = ({ dragNode, dropNode, dropPosition }) => {
    const dragData = dragNode.data;
    const dropData = dropNode.data;

    // 文件夹只能拖到文件夹之间
    if (dragData.type === 'folder') {
      return dropData.type === 'folder';
    }

    // 表单可以拖到文件夹或其他表单
    if (dragData.type === 'group') {
      return true;
    }

    return false;
  };

  return (
    <div className="folder-tree" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 添加访视按钮 - 居中显示 */}
      {!readonly && onAddFolder && (
        <div style={{ marginBottom: 12, flexShrink: 0, textAlign: 'center' }}>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={onAddFolder}
          >
            新建分类
          </Button>
        </div>
      )}

      {folders.length === 0 ? (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#fff',
          borderRadius: 4
        }}>
          <Empty
            description="暂无数据"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Tree
            showIcon
            blockNode
            draggable={!readonly && {
              icon: false,
              nodeDraggable: () => true
            }}
            expandedKeys={expandedKeys}
            selectedKeys={selectedKeys}
            treeData={treeData}
            onSelect={handleSelect}
            onExpand={handleExpand}
            onDrop={!readonly ? handleDrop : undefined}
            allowDrop={!readonly ? allowDrop : undefined}
            className="design-tree"
          />
        </div>
      )}
    </div>
  );
};

export default FolderTree;
