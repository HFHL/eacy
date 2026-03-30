/**
 * UID生成器
 */

import { VERSION_CONFIG } from '../core/constants';

/**
 * 生成字段UID
 * @param {string} path - 字段路径（可选，用于生成稳定的UID）
 * @returns {string} UID
 */
export function generateFieldUID(path = null) {
  if (path) {
    // 基于路径生成稳定UID
    const crypto = window.crypto || window.msCrypto;
    const encoder = new TextEncoder();
    const data = encoder.encode(path);
    const hashBuffer = crypto.subtle.digestSync('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${VERSION_CONFIG.uidPrefix}${hashHex.substring(0, VERSION_CONFIG.uidLength)}`;
  }

  // 生成随机UID
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${VERSION_CONFIG.uidPrefix}${randomStr.padEnd(VERSION_CONFIG.uidLength, '0').substring(0, VERSION_CONFIG.uidLength)}`;
}

/**
 * 验证UID格式
 * @param {string} uid - 待验证的UID
 * @returns {boolean} 是否有效
 */
export function isValidUID(uid) {
  return new RegExp(`^${VERSION_CONFIG.uidPrefix}[a-z0-9]{${VERSION_CONFIG.uidLength}}$`, 'i').test(uid);
}

/**
 * 生成临时ID（非UID，用于内部标识）
 * @param {string} prefix - 前缀
 * @returns {string} 临时ID
 */
export function generateTempId(prefix = 'temp') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
