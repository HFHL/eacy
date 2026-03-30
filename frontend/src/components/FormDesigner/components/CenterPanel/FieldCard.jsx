/**
 * FieldCard - 字段卡片组件
 * 中间面板：设计画布中的单个字段卡片
 * 以表单填写预览形式展示字段设计
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Input, 
  InputNumber, 
  DatePicker, 
  Radio, 
  Checkbox, 
  Select, 
  Slider,
  Table,
  Typography,
  Space,
  Button
} from 'antd';
import { 
  HolderOutlined, 
  CopyOutlined, 
  DeleteOutlined,
  MinusCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ContextMenu, { createFieldMenuItems } from '../ContextMenu';

const { Text } = Typography;

/**
 * 可编辑选项组件 - 用于 radio/checkbox/select 选项的编辑
 */
const EditableOption = ({ 
  option, 
  index, 
  isHovered, 
  onEdit, 
  onDelete, 
  onCopy,
  type = 'radio' // radio, checkbox
}) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(typeof option === 'object' ? option.label : option);
  const inputRef = useRef(null);
  const [optionHovered, setOptionHovered] = useState(false);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (value !== (typeof option === 'object' ? option.label : option)) {
      onEdit?.(index, value);
    }
  };

  const handleKeyDown = (e) => {
    if (isComposingRef.current) return;
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setValue(typeof option === 'object' ? option.label : option);
      setEditing(false);
    }
  };

  const optionLabel = typeof option === 'object' ? option.label : option;

  return (
    <div 
      className="editable-option-item"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        padding: '4px 8px',
        marginLeft: -8,
        borderRadius: 4,
        background: optionHovered ? '#f5f5f5' : 'transparent',
        transition: 'background 0.2s'
      }}
      onMouseEnter={() => setOptionHovered(true)}
      onMouseLeave={() => setOptionHovered(false)}
    >
      {type === 'radio' ? (
        <Radio disabled value={option} />
      ) : (
        <Checkbox disabled value={option} />
      )}
      
      {editing ? (
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={() => { isComposingRef.current = false; }}
          size="small"
          style={{ 
            width: 150,
            borderColor: '#1890ff'
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          style={{
            cursor: 'text',
            padding: '2px 6px',
            borderRadius: 4,
            border: optionHovered ? '1px dashed #1890ff' : '1px dashed transparent',
            transition: 'border 0.2s',
            minWidth: 60
          }}
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          {optionLabel}
        </span>
      )}

      {/* 选项操作按钮 */}
      {optionHovered && !editing && (
        <Space size={4} style={{ marginLeft: 'auto' }}>
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined style={{ fontSize: 12 }} />}
            onClick={(e) => {
              e.stopPropagation();
              onCopy?.(index);
            }}
            style={{ padding: '0 4px', height: 20 }}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<MinusCircleOutlined style={{ fontSize: 12 }} />}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(index);
            }}
            style={{ padding: '0 4px', height: 20 }}
          />
        </Space>
      )}
    </div>
  );
};

/**
 * 可编辑文本组件 - 通用的内联编辑组件
 * 用于矩阵的题目/选项、表格的列名等
 */
const EditableText = ({
  value,
  onChange,
  placeholder = '点击编辑',
  style = {},
  textStyle = {},
  hoverBorder = true
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [textHovered, setTextHovered] = useState(false);
  const inputRef = useRef(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleBlur = () => {
    setEditing(false);
    if (inputValue !== value && inputValue.trim()) {
      onChange?.(inputValue.trim());
    } else {
      setInputValue(value);
    }
  };

  const handleKeyDown = (e) => {
    if (isComposingRef.current) return;
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setInputValue(value);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { isComposingRef.current = false; }}
        size="small"
        style={{ 
          width: 100,
          borderColor: '#1890ff',
          ...style
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      style={{
        padding: '2px 6px',
        borderRadius: 4,
        cursor: 'text',
        border: hoverBorder && textHovered ? '1px dashed #1890ff' : '1px dashed transparent',
        background: textHovered ? '#f0f7ff' : 'transparent',
        transition: 'all 0.2s',
        ...textStyle
      }}
      onMouseEnter={() => setTextHovered(true)}
      onMouseLeave={() => setTextHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {value || placeholder}
    </span>
  );
};

/**
 * 可编辑字段名组件
 */
const EditableFieldName = ({ 
  value, 
  onChange, 
  isHovered,
  unit 
}) => {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef(null);
  const isComposingRef = useRef(false);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleBlur = () => {
    setEditing(false);
    if (inputValue !== value && inputValue.trim()) {
      onChange?.(inputValue.trim());
    } else {
      setInputValue(value);
    }
  };

  const handleKeyDown = (e) => {
    if (isComposingRef.current) return;
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setInputValue(value);
      setEditing(false);
    }
  };

  const displayText = unit ? `${value} [${unit}]` : value;

  if (editing) {
    return (
      <Input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onCompositionStart={() => { isComposingRef.current = true; }}
        onCompositionEnd={() => { isComposingRef.current = false; }}
        size="small"
        style={{ 
          width: 200,
          fontWeight: 600,
          borderColor: '#1890ff'
        }}
        onClick={(e) => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      style={{
        fontWeight: 600,
        color: '#333',
        fontSize: 14,
        padding: '2px 8px',
        borderRadius: 4,
        cursor: 'text',
        border: isHovered ? '1px dashed #1890ff' : '1px dashed transparent',
        background: isHovered ? '#f0f7ff' : 'transparent',
        transition: 'all 0.2s'
      }}
      onClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {displayText}
    </span>
  );
};

/**
 * 表格子字段组件 - 可编辑子字段名称，支持拖拽排序
 */
const TableChildField = ({
  child,
  index,
  isHovered,
  onSelect,
  onNameEdit,
  onDelete,
  dragHandleProps
}) => {
  const [childHovered, setChildHovered] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 12px',
        background: '#fff',
        borderRadius: 4,
        border: childHovered ? '1px solid #1890ff' : '1px solid #f0f0f0',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: childHovered ? '0 2px 8px rgba(0, 0, 0, 0.1)' : 'none'
      }}
      onMouseEnter={() => setChildHovered(true)}
      onMouseLeave={() => setChildHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* 拖拽手柄 */}
      {dragHandleProps && (
        <span
          style={{
            cursor: 'grab',
            color: '#bfbfbf',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }}
          {...dragHandleProps.attributes}
          {...dragHandleProps.listeners}
        >
          <HolderOutlined />
        </span>
      )}

      {/* 列名称 */}
      <div style={{ minWidth: 80, flexShrink: 0 }}>
        <EditableText
          value={child.name || `列${index + 1}`}
          onChange={onNameEdit}
          textStyle={{ 
            fontSize: 13, 
            color: '#333',
            fontWeight: 500
          }}
          hoverBorder={childHovered}
        />
      </div>
      
      {/* 字段预览 */}
      <div style={{ flex: 1 }}>
        <FieldInputPreviewSimple field={child} />
      </div>

      {/* 删除按钮 - 悬停显示 */}
      {childHovered && onDelete && (
        <Button
          type="text"
          size="small"
          danger
          icon={<MinusCircleOutlined style={{ fontSize: 14 }} />}
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          style={{ flexShrink: 0 }}
        />
      )}
    </div>
  );
};

/**
 * 可排序的表格子字段包装器
 */
const SortableTableChildField = (props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: props.child.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TableChildField
        {...props}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
};

/**
 * 简化的字段预览（用于表格子字段，不带编辑功能）
 */
const FieldInputPreviewSimple = ({ field = {} }) => {
  const { displayType = 'text', unit } = field || {};

  switch (displayType) {
    case 'text':
      return <Input placeholder="请输入" disabled size="small" style={{ maxWidth: 100, background: '#fafafa' }} />;
    case 'number':
      return (
        <Space size={4}>
          <InputNumber placeholder="请输入" disabled size="small" style={{ width: 80, background: '#fafafa' }} />
          {unit && <Text type="secondary" style={{ fontSize: 11 }}>{unit}</Text>}
        </Space>
      );
    case 'date':
      return <DatePicker placeholder="选择日期" disabled size="small" style={{ width: 110 }} />;
    case 'select':
      return <Select placeholder="请选择" disabled size="small" style={{ width: 100 }} />;
    default:
      return <Input placeholder="请输入" disabled size="small" style={{ maxWidth: 100, background: '#fafafa' }} />;
  }
};

/**
 * 渲染字段输入预览 - 带可编辑选项
 */
const FieldInputPreview = ({
  field = {},
  isHovered = false,
  onOptionEdit,
  onOptionDelete,
  onOptionCopy,
  onAddOption,
  onChildSelect,
  onAddTableChild,
  onAddTableRow,
  onDeleteTableChild,
  onAddMatrixRow,
  onAddMatrixCol,
  onMatrixRowEdit,
  onMatrixColEdit,
  onCopyMatrixRow,
  onDeleteMatrixRow,
  onTableChildNameEdit,
  onReorderTableChildren
}) => {
  const { displayType = 'text', unit } = field || {};
  // 确保 options 是数组
  const options = Array.isArray(field?.options) ? field.options : [];

  // 默认选项（用于选择类字段预览）
  const defaultOptions = options.length > 0 
    ? options 
    : ['选项1', '选项2', '选项3'];

  switch (displayType) {
    case 'text':
      return (
        <Input 
          placeholder="请输入" 
          disabled 
          style={{ maxWidth: 400, background: '#fafafa' }}
        />
      );

    case 'textarea':
      return (
        <Input.TextArea 
          placeholder="请输入" 
          disabled 
          rows={2}
          style={{ maxWidth: 400, background: '#fafafa' }}
        />
      );

    case 'number':
      return (
        <Space>
          <InputNumber 
            placeholder="请输入" 
            disabled 
            style={{ width: 150, background: '#fafafa' }}
          />
          {unit && <Text type="secondary">{unit}</Text>}
        </Space>
      );

    case 'date':
      return (
        <DatePicker 
          placeholder="请选择日期" 
          disabled 
          style={{ maxWidth: 200 }}
        />
      );

    case 'radio':
      return (
        <div>
          <div style={{ marginBottom: 4 }}>
            {defaultOptions.map((opt, idx) => (
              <EditableOption
                key={idx}
                option={opt}
                index={idx}
                isHovered={isHovered}
                onEdit={onOptionEdit}
                onDelete={onOptionDelete}
                onCopy={onOptionCopy}
                type="radio"
              />
            ))}
          </div>
          {isHovered && (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onAddOption?.();
              }}
              style={{ padding: '0 8px', marginTop: 4 }}
            >
              添加选项
            </Button>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div>
          <div style={{ marginBottom: 4 }}>
            {defaultOptions.map((opt, idx) => (
              <EditableOption
                key={idx}
                option={opt}
                index={idx}
                isHovered={isHovered}
                onEdit={onOptionEdit}
                onDelete={onOptionDelete}
                onCopy={onOptionCopy}
                type="checkbox"
              />
            ))}
          </div>
          {isHovered && (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onAddOption?.();
              }}
              style={{ padding: '0 8px', marginTop: 4 }}
            >
              添加选项
            </Button>
          )}
        </div>
      );

    case 'select':
      return (
        <Select
          placeholder="请选择"
          disabled
          style={{ width: 200 }}
          options={defaultOptions.map(opt => ({
            value: typeof opt === 'object' ? opt.value : opt,
            label: typeof opt === 'object' ? opt.label : opt
          }))}
        />
      );

    case 'multiselect':
      return (
        <Select
          mode="multiple"
          placeholder="请选择"
          disabled
          style={{ width: 300 }}
          options={defaultOptions.map(opt => ({
            value: typeof opt === 'object' ? opt.value : opt,
            label: typeof opt === 'object' ? opt.label : opt
          }))}
        />
      );

    case 'slider':
      return (
        <div style={{ width: 300, padding: '0 10px' }}>
          <Slider disabled defaultValue={0} />
        </div>
      );

    case 'matrix_radio':
    case 'matrix_checkbox':
      const isRadioMatrix = displayType === 'matrix_radio';
      const matrixConfig = field?.config || {};
      const matrixRows = matrixConfig.rows || ['题目1', '题目2'];
      const matrixCols = matrixConfig.cols || ['选项1', '选项2', '选项3'];

      // 矩阵行悬停状态组件
      const MatrixRowCell = ({ text, rowIdx }) => {
        const [rowHovered, setRowHovered] = useState(false);
        return (
          <div
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4,
              minWidth: 120
            }}
            onMouseEnter={() => setRowHovered(true)}
            onMouseLeave={() => setRowHovered(false)}
          >
            <EditableText
              value={text}
              onChange={(newValue) => onMatrixRowEdit?.(rowIdx, newValue)}
              textStyle={{ fontWeight: 500 }}
              hoverBorder={isHovered}
            />
            {rowHovered && isHovered && (
              <Space size={2} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined style={{ fontSize: 12 }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyMatrixRow?.(rowIdx);
                  }}
                  style={{ padding: '0 4px', height: 20 }}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined style={{ fontSize: 12 }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteMatrixRow?.(rowIdx);
                  }}
                  style={{ padding: '0 4px', height: 20 }}
                />
              </Space>
            )}
          </div>
        );
      };

      return (
        <div>
          <Table
            columns={[
              { 
                title: '', 
                dataIndex: 'row', 
                key: 'row', 
                width: 150,
                render: (text, record, rowIdx) => (
                  <MatrixRowCell text={text} rowIdx={rowIdx} />
                )
              },
              ...matrixCols.map((col, colIdx) => ({
                title: (
                  <EditableText
                    value={col}
                    onChange={(newValue) => onMatrixColEdit?.(colIdx, newValue)}
                    hoverBorder={isHovered}
                  />
                ),
                dataIndex: `col${colIdx}`,
                key: `col${colIdx}`,
                width: 100,
                render: () => isRadioMatrix
                  ? <Radio disabled />
                  : <Checkbox disabled />
              }))
            ]}
            dataSource={matrixRows.map((row, idx) => ({
              key: idx,
              row: row
            }))}
            pagination={false}
            size="small"
            bordered
            style={{ maxWidth: 500 }}
          />
          {isHovered && (
            <Space style={{ marginTop: 8 }}>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddMatrixRow?.();
                }}
              >
                新增题目
              </Button>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onAddMatrixCol?.();
                }}
              >
                添加选项
              </Button>
            </Space>
          )}
        </div>
      );

    case 'table':
      // 兼容两种数据来源：直接 multiRow 属性 或 config.tableRows
      const _multiRowRaw = field?.multiRow ?? (field?.config?.tableRows === 'multiRow');
      const { children: _children = [] } = field || {};
      const multiRow = !!_multiRowRaw;
      const tableChildren = Array.isArray(_children) ? _children : [];

      return (
        <div style={{
          border: '1px solid #f0f0f0',
          borderRadius: 4,
          padding: 12,
          background: '#fafafa'
        }}>
          {/* 表格头部 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f5f5f5',
            padding: '8px 12px',
            marginBottom: 12,
            borderRadius: 4,
            fontSize: 13,
            color: '#666'
          }}>
            <Text style={{ fontSize: 13 }}>
              {multiRow ? '固定表格（多行）' : '固定表格（单行）'}
            </Text>
            {isHovered && (
              <Space size={8}>
                <Button
                  type="link"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddTableChild?.();
                  }}
                >
                  添加列
                </Button>
                {multiRow && (
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddTableRow?.();
                    }}
                  >
                    新增一行
                  </Button>
                )}
              </Space>
            )}
          </div>

          {/* 子字段列表 - 每列一行，支持拖拽排序 */}
          {tableChildren.length > 0 ? (
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={(event) => {
                const { active, over } = event;
                if (!over || active.id === over.id) return;
                const oldIndex = tableChildren.findIndex(c => c.id === active.id);
                const newIndex = tableChildren.findIndex(c => c.id === over.id);
                if (oldIndex === -1 || newIndex === -1) return;
                const newChildren = arrayMove(tableChildren, oldIndex, newIndex);
                onReorderTableChildren?.(newChildren);
              }}
            >
              <SortableContext
                items={tableChildren.map(c => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tableChildren.map((child, idx) => (
                    <SortableTableChildField
                      key={child.id || idx}
                      child={child}
                      index={idx}
                      isHovered={isHovered}
                      onSelect={() => onChildSelect?.(child.id)}
                      onNameEdit={(newName) => onTableChildNameEdit?.(idx, newName)}
                      onDelete={() => onDeleteTableChild?.(idx)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>
              暂无子字段，点击"添加列"添加表格列
            </Text>
          )}
        </div>
      );

    case 'file':
      const { fileSubtype = 'any' } = field || {};
      // 根据文件子类型显示不同的提示
      let filePrompt = '';
      let fileIcon = '📎';
      switch (fileSubtype) {
        case 'image':
          filePrompt = '点击上传图片';
          fileIcon = '🖼️';
          break;
        case 'pdf':
          filePrompt = '请上传PDF文件';
          fileIcon = '📄';
          break;
        case 'dicom':
          filePrompt = '请上传DICOM影像文件（.dcm, .dicom）';
          fileIcon = '🏥';
          break;
        case 'pathology':
          filePrompt = '请上传病理切片文件（.svs, .scn, .ndpi）';
          fileIcon = '🔬';
          break;
        case 'any':
        default:
          filePrompt = '点击上传文件至此，支持压缩包（rar|zip）、视频（mp4|mov|avi）、office（doc|docx|xls|xlsx|pdf）、图片（jpg|jpeg|png）文件';
          fileIcon = '📁';
          break;
      }
      return (
        <div style={{ 
          border: '1px dashed #d9d9d9', 
          borderRadius: 4, 
          padding: '20px 12px',
          background: '#fafafa',
          textAlign: 'center',
          color: '#999',
          maxWidth: 300
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>{fileIcon}</div>
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>{filePrompt}</div>
        </div>
      );

    case 'paragraph':
      return (
        <div style={{ 
          padding: '12px', 
          background: '#f5f5f5', 
          borderRadius: 4,
          color: '#666',
          fontSize: 13
        }}>
          段落说明文字内容...
        </div>
      );

    case 'divider':
      return (
        <div style={{ 
          borderTop: '1px solid #e8e8e8', 
          margin: '8px 0',
          width: '100%'
        }} />
      );

    case 'cascader':
      return (
        <Select
          placeholder="请选择省/市/区"
          disabled
          style={{ width: 250 }}
        />
      );

    case 'randomization':
      // 随机化分组 - 显示类似单选题，默认选项为"试验组"和"对照组"
      const randomOptions = (field && Array.isArray(field.options) && field.options.length > 0)
        ? field.options
        : ['试验组', '对照组'];
      return (
        <div>
          <div style={{ marginBottom: 4 }}>
            {randomOptions.map((opt, idx) => (
              <EditableOption
                key={idx}
                option={opt}
                index={idx}
                isHovered={isHovered}
                onEdit={onOptionEdit}
                onDelete={onOptionDelete}
                onCopy={onOptionCopy}
                type="radio"
              />
            ))}
          </div>
          {isHovered && (
            <Button
              type="link"
              size="small"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onAddOption?.();
              }}
              style={{ padding: '0 8px', marginTop: 4 }}
            >
              添加选项
            </Button>
          )}
        </div>
      );

    default:
      return (
        <Input 
          placeholder="请输入" 
          disabled 
          style={{ maxWidth: 400, background: '#fafafa' }}
        />
      );
  }
};

/**
 * 字段卡片组件
 */
const FieldCard = ({
  field = {},
  index = 0,
  selected = false,
  onSelect = null,
  onEdit = null,
  onDelete = null,
  onCopy = null,
  onFieldNameChange = null,
  onOptionsChange = null,
  onChildSelect = null,
  onAddTableChild = null,
  onAddTableRow = null,
  onDeleteTableChild = null,
  onAddMatrixRow = null,
  onAddMatrixCol = null,
  onCopyMatrixRow = null,
  onDeleteMatrixRow = null,
  onMatrixConfigChange = null,
  onTableChildNameChange = null,
  onReorderTableChildren = null,
  readonly = false,
  dragHandleProps = null
}) => {
  const [hovered, setHovered] = useState(false);
  const [nameHovered, setNameHovered] = useState(false);

  // 处理点击
  const handleClick = (e) => {
    e.stopPropagation(); // 阻止事件冒泡到父级GroupCard
    if (onSelect) onSelect();
  };

  // 右键菜单项
  const contextMenuItems = createFieldMenuItems({
    onEdit,
    onCopy,
    onDelete,
    readonly
  });

  // 确保 field 对象存在
  const safeField = field || {};
  
  // 处理字段名修改
  const handleFieldNameChange = (newName) => {
    if (onFieldNameChange) {
      onFieldNameChange(safeField.id, newName);
    }
  };

  // 处理选项编辑
  const handleOptionEdit = (index, newValue) => {
    if (onOptionsChange && safeField.options) {
      const newOptions = [...safeField.options];
      newOptions[index] = newValue;
      onOptionsChange(safeField.id, newOptions);
    }
  };

  // 处理选项删除
  const handleOptionDelete = (index) => {
    if (onOptionsChange && safeField.options) {
      const newOptions = safeField.options.filter((_, i) => i !== index);
      onOptionsChange(safeField.id, newOptions);
    }
  };

  // 处理选项复制
  const handleOptionCopy = (index) => {
    if (onOptionsChange && safeField.options) {
      const newOptions = [...safeField.options];
      const optionToCopy = safeField.options[index];
      newOptions.splice(index + 1, 0, `${optionToCopy}_副本`);
      onOptionsChange(safeField.id, newOptions);
    }
  };

  // 处理添加选项
  const handleAddOption = () => {
    if (onOptionsChange) {
      const currentOptions = safeField.options || [];
      const newOptions = [...currentOptions, `选项${currentOptions.length + 1}`];
      onOptionsChange(safeField.id, newOptions);
    }
  };

  // 处理矩阵行编辑（题目）
  const handleMatrixRowEdit = (rowIdx, newValue) => {
    if (onMatrixConfigChange) {
      const currentConfig = safeField.config || { rows: [], cols: [] };
      const newRows = [...(currentConfig.rows || ['题目1', '题目2'])];
      newRows[rowIdx] = newValue;
      onMatrixConfigChange(safeField.id, { ...currentConfig, rows: newRows });
    }
  };

  // 处理矩阵列编辑（选项）
  const handleMatrixColEdit = (colIdx, newValue) => {
    if (onMatrixConfigChange) {
      const currentConfig = safeField.config || { rows: [], cols: [] };
      const newCols = [...(currentConfig.cols || ['选项1', '选项2', '选项3'])];
      newCols[colIdx] = newValue;
      onMatrixConfigChange(safeField.id, { ...currentConfig, cols: newCols });
    }
  };

  // 处理表格子字段名编辑
  const handleTableChildNameEdit = (childId, newName) => {
    if (onTableChildNameChange) {
      onTableChildNameChange(safeField.id, childId, newName);
    }
  };

  return (
    <ContextMenu items={contextMenuItems} disabled={readonly}>
      <div
        className={`field-card-preview ${selected ? 'selected' : ''} ${hovered ? 'hovered' : ''}`}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: '16px 20px',
          marginBottom: 16,
          background: selected ? '#f0f7ff' : '#fff',
          borderRadius: 8,
          border: selected ? '2px solid #1890ff' : '1px solid #f0f0f0',
          boxShadow: hovered ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
          transition: 'all 0.2s',
          cursor: 'pointer',
          position: 'relative'
        }}
      >
        {/* 字段标题行 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: 12,
          gap: 8
        }}>
          {/* 拖拽手柄 */}
          {dragHandleProps && !readonly && (
            <span
              style={{ 
                cursor: 'grab', 
                color: '#bfbfbf',
                display: 'flex',
                alignItems: 'center'
              }}
              {...dragHandleProps.attributes}
              {...dragHandleProps.listeners}
            >
              <HolderOutlined />
            </span>
          )}
          
          {/* 序号 */}
          <Text strong style={{ color: '#999', fontSize: 14, minWidth: 20 }}>
            {index + 1}
          </Text>
          
          {/* 字段名称 - 可编辑 */}
          <div 
            onMouseEnter={() => setNameHovered(true)}
            onMouseLeave={() => setNameHovered(false)}
          >
            <EditableFieldName
              value={safeField.name || '未命名字段'}
              onChange={handleFieldNameChange}
              isHovered={nameHovered}
              unit={safeField.unit}
            />
          </div>

          {/* 右侧操作按钮 - 悬停显示 */}
          {hovered && !readonly && (
            <Space size={4} style={{ marginLeft: 'auto' }}>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy?.();
                }}
              />
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              />
            </Space>
          )}
        </div>

        {/* 字段输入预览 */}
        <div style={{ paddingLeft: dragHandleProps ? 24 : 0 }}>
          <FieldInputPreview
            field={safeField}
            isHovered={hovered}
            onOptionEdit={handleOptionEdit}
            onOptionDelete={handleOptionDelete}
            onOptionCopy={handleOptionCopy}
            onAddOption={handleAddOption}
            onChildSelect={(childId) => {
              if (onChildSelect) {
                onChildSelect(safeField.id, childId);
              }
            }}
            onAddTableChild={() => {
              if (onAddTableChild) {
                onAddTableChild(safeField.id);
              }
            }}
            onAddTableRow={() => {
              if (onAddTableRow) {
                onAddTableRow(safeField.id);
              }
            }}
            onDeleteTableChild={(childIdx) => {
              if (onDeleteTableChild) {
                onDeleteTableChild(safeField.id, childIdx);
              }
            }}
            onAddMatrixRow={() => {
              if (onAddMatrixRow) {
                onAddMatrixRow(safeField.id);
              }
            }}
            onAddMatrixCol={() => {
              if (onAddMatrixCol) {
                onAddMatrixCol(safeField.id);
              }
            }}
            onCopyMatrixRow={(rowIdx) => {
              if (onCopyMatrixRow) {
                onCopyMatrixRow(safeField.id, rowIdx);
              }
            }}
            onDeleteMatrixRow={(rowIdx) => {
              if (onDeleteMatrixRow) {
                onDeleteMatrixRow(safeField.id, rowIdx);
              }
            }}
            onMatrixRowEdit={handleMatrixRowEdit}
            onMatrixColEdit={handleMatrixColEdit}
            onTableChildNameEdit={handleTableChildNameEdit}
            onReorderTableChildren={(newChildren) => {
              if (onReorderTableChildren) {
                onReorderTableChildren(safeField.id, newChildren);
              }
            }}
          />
        </div>
      </div>
    </ContextMenu>
  );
};

export default FieldCard;
