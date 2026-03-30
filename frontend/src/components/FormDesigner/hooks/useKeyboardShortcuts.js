/**
 * useKeyboardShortcuts - 键盘快捷键Hook
 * 管理表单设计器的所有键盘快捷键
 */

import { useEffect, useCallback } from 'react';

/**
 * 快捷键配置Hook
 * @param {Object} shortcuts - 快捷键配置对象
 * @param {boolean} enabled - 是否启用快捷键
 */
export const useKeyboardShortcuts = (shortcuts = {}, enabled = true) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // 检查是否在输入框中
      const target = e.target;
      const isInInput = (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('.ant-input') ||
        target.closest('.ant-select')
      );

      // 如果在输入框中，且不是Ctrl组合键，则不触发快捷键
      if (isInInput && !ctrl) {
        return;
      }

      // 构建快捷键标识
      const shortcutKey = [
        ctrl ? 'ctrl' : '',
        shift ? 'shift' : '',
        alt ? 'alt' : '',
        key.toLowerCase()
      ].filter(Boolean).join('+');

      // 查找匹配的快捷键
      const handler = shortcuts[shortcutKey];
      if (handler) {
        e.preventDefault();
        e.stopPropagation();
        handler(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
};

/**
 * 预定义的快捷键组合
 */
export const SHORTCUT_KEYS = {
  SAVE: 'ctrl+s',
  UNDO: 'ctrl+z',
  REDO: 'ctrl+shift+z', // Windows/Linux
  REDO_ALT: 'ctrl+y',    // Mac
  DELETE: 'delete',
  BACKSPACE: 'backspace',
  COPY: 'ctrl+c',
  PASTE: 'ctrl+v',
  ESC: 'escape',
  SELECT_ALL: 'ctrl+a',
  FIND: 'ctrl+f',
  PREVIEW: 'ctrl+p',
  EXPORT: 'ctrl+e',
  IMPORT: 'ctrl+i'
};

/**
 * 创建快捷键帮助文本
 */
export const getShortcutHelpText = (shortcutKey) => {
  const parts = shortcutKey.split('+');
  const keyMap = {
    'ctrl': 'Ctrl',
    'shift': 'Shift',
    'alt': 'Alt',
    'meta': 'Cmd'
  };

  return parts
    .map(part => keyMap[part] || part.toUpperCase())
    .join(isMac() ? '' : '+')
    .replace(/(?<=Ctrl)\+?/g, isMac() ? '' : '+')
    .replace(/(?<=Cmd)\+?/g, '');
};

/**
 * 检测是否为Mac系统
 */
export const isMac = () => {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
};

export default useKeyboardShortcuts;
