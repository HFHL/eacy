/**
 * useSchemaParser Hook
 * 用于解析和生成JSON Schema
 */

import { useState, useCallback } from 'react';
import SchemaParser from '../core/SchemaParser';
import SchemaGenerator from '../core/SchemaGenerator';
import { schemaValidator, normalizeSchemaForDesigner } from '../core/validators';
import DesignModel from '../core/DesignModel';

/**
 * Schema解析Hook
 * @param {Object} options - 配置选项
 * @returns {Object} Hook返回值
 */
export const useSchemaParser = (options = {}) => {
  const { onParseSuccess, onParseError, onGenerateSuccess, onGenerateError } = options;

  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);

  /**
   * 解析JSON Schema
   */
  const parseSchema = useCallback((schema) => {
    setIsParsing(true);
    setParseErrors([]);

    try {
      // 先做兼容归一化：支持历史/外部 schema（根级直接是 group 的结构）
      schema = normalizeSchemaForDesigner(schema);

      // 验证Schema格式
      const validation = schemaValidator.validateSchemaFormat(schema);
      if (!validation.valid) {
        setParseErrors(validation.errors);
        setIsParsing(false);
        if (onParseError) {
          onParseError(validation.errors);
        }
        return { success: false, errors: validation.errors, data: null };
      }

      // 解析Schema
      const designData = SchemaParser.parseSchema(schema);

      setIsParsing(false);
      if (onParseSuccess) {
        onParseSuccess(designData);
      }

      return { success: true, errors: [], data: designData };
    } catch (error) {
      const errors = [{ message: `解析失败: ${error.message}` }];
      setParseErrors(errors);
      setIsParsing(false);
      if (onParseError) {
        onParseError(errors);
      }
      return { success: false, errors, data: null };
    }
  }, [onParseSuccess, onParseError]);

  /**
   * 从文件加载Schema
   */
  const loadSchemaFromFile = useCallback((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const schema = JSON.parse(e.target.result);
          const result = parseSchema(schema);
          resolve(result);
        } catch (error) {
          const errors = [{ message: `文件解析失败: ${error.message}` }];
          reject({ success: false, errors });
        }
      };
      reader.onerror = () => {
        const errors = [{ message: '文件读取失败' }];
        reject({ success: false, errors });
      };
      reader.readAsText(file);
    });
  }, [parseSchema]);

  /**
   * 生成JSON Schema
   */
  const generateSchema = useCallback((designData) => {
    setIsGenerating(true);

    try {
      // 验证设计数据
      const validation = schemaValidator.validateDesignModel(designData);
      if (!validation.valid) {
        setIsGenerating(false);
        if (onGenerateError) {
          onGenerateError(validation.errors);
        }
        return { success: false, errors: validation.errors, schema: null };
      }

      // 生成Schema
      const schema = SchemaGenerator.generateSchema(designData);

      setIsGenerating(false);
      if (onGenerateSuccess) {
        onGenerateSuccess(schema);
      }

      return { success: true, errors: [], schema };
    } catch (error) {
      const errors = [{ message: `生成失败: ${error.message}` }];
      setIsGenerating(false);
      if (onGenerateError) {
        onGenerateError(errors);
      }
      return { success: false, errors, schema: null };
    }
  }, [onGenerateSuccess, onGenerateError]);

  /**
   * 下载Schema文件
   */
  const downloadSchema = useCallback((schema, filename = 'schema.json') => {
    const blob = new Blob([JSON.stringify(schema, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  /**
   * 清除错误
   */
  const clearErrors = useCallback(() => {
    setParseErrors([]);
  }, []);

  return {
    // 状态
    isParsing,
    isGenerating,
    parseErrors,

    // 方法
    parseSchema,
    loadSchemaFromFile,
    generateSchema,
    downloadSchema,
    clearErrors
  };
};

export default useSchemaParser;
