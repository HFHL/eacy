/**
 * ContextMenu - 右键菜单组件
 * 为树节点和字段卡片提供右键菜单功能
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Dropdown } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  FolderAddOutlined,
  AppstoreAddOutlined,
  ReloadOutlined
} from '@ant-design/icons';

/**
 * 上下文菜单组件
 */
const ContextMenu = ({
  children,
  items = [],
  disabled = false
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef(null);

  // 处理右键点击
  const handleContextMenu = useCallback((e) => {
    if (disabled) return;

    e.preventDefault();
    e.stopPropagation();

    setPosition({
      x: e.clientX,
      y: e.clientY
    });
    setVisible(true);
  }, [disabled]);

  // 关闭菜单
  const closeMenu = useCallback(() => {
    setVisible(false);
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    if (visible) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', closeMenu);

      return () => {
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('contextmenu', closeMenu);
      };
    }
  }, [visible, closeMenu]);

  // 转换菜单项为Dropdown格式
  const menuItems = items.map(item => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    danger: item.danger || false,
    disabled: item.disabled || false,
    onClick: () => {
      if (item.onClick) {
        item.onClick();
      }
      closeMenu();
    }
  }));

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
        {children}
      </div>

      {visible && (
        <Dropdown
          open={visible}
          menu={{ items: menuItems }}
          placement="bottomLeft"
          trigger={[]}
        >
          <div
            ref={menuRef}
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              width: 0,
              height: 0,
              pointerEvents: 'none'
            }}
          />
        </Dropdown>
      )}
    </>
  );
};

/**
 * 创建树节点菜单项
 */
export const createTreeMenuItems = ({
  onAddFolder = null,
  onAddGroup = null,
  onEdit = null,
  onDelete = null,
  readonly = false
} = {}) => {
  const items = [];

  if (!readonly) {
    if (onAddFolder) {
      items.push({
        key: 'add-folder',
        label: '添加访视',
        icon: <FolderAddOutlined />,
        onClick: onAddFolder
      });
    }

    if (onAddGroup) {
      items.push({
        key: 'add-group',
        label: '添加表单',
        icon: <AppstoreAddOutlined />,
        onClick: onAddGroup
      });
    }

    if (items.length > 0) {
      items.push({ type: 'divider' });
    }

    if (onEdit) {
      items.push({
        key: 'edit',
        label: '编辑',
        icon: <EditOutlined />,
        onClick: onEdit
      });
    }

    if (onDelete) {
      items.push({
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: onDelete
      });
    }
  }

  return items;
};

/**
 * 创建字段卡片菜单项
 */
export const createFieldMenuItems = ({
  onEdit = null,
  onCopy = null,
  onDelete = null,
  readonly = false
} = {}) => {
  const items = [];

  if (!readonly) {
    if (onEdit) {
      items.push({
        key: 'edit',
        label: '编辑',
        icon: <EditOutlined />,
        onClick: onEdit
      });
    }

    if (onCopy) {
      items.push({
        key: 'copy',
        label: '复制',
        icon: <CopyOutlined />,
        onClick: onCopy
      });
    }

    if (items.length > 0) {
      items.push({ type: 'divider' });
    }

    if (onDelete) {
      items.push({
        key: 'delete',
        label: '删除',
        icon: <DeleteOutlined />,
        danger: true,
        onClick: onDelete
      });
    }
  }

  return items;
};

export default ContextMenu;
