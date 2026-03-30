/**
 * PreviewModal - 表单预览模态框
 * 以只读模式展示表单的最终渲染效果
 */

import React, { useMemo } from 'react';
import { Modal, Tabs, Empty, Tag, Space } from 'antd';
import {
  FileTextOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import FormRenderer from './FormRenderer';

const { TabPane } = Tabs;

/**
 * 预览模态框组件
 */
const PreviewModal = ({
  visible = false,
  data = null,
  onCancel = null
}) => {
  // 统计信息
  const stats = useMemo(() => {
    if (!data || !data.folders) {
      return { folders: 0, groups: 0, fields: 0 };
    }

    let groups = 0;
    let fields = 0;

    data.folders.forEach(folder => {
      if (folder.groups) {
        groups += folder.groups.length;
        folder.groups.forEach(group => {
          if (group.fields) {
            fields += group.fields.length;
          }
        });
      }
    });

    return {
      folders: data.folders.length,
      groups,
      fields
    };
  }, [data]);

  // 空状态
  if (!data || !data.folders || data.folders.length === 0) {
    return (
      <Modal
        title="表单预览"
        open={visible}
        onCancel={onCancel}
        width={1000}
        footer={null}
      >
        <Empty
          description="暂无数据可预览"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </Modal>
    );
  }

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          <span>表单预览</span>
          <Tag color="blue">{stats.folders} 个访视</Tag>
          <Tag color="green">{stats.groups} 个表单</Tag>
          <Tag color="orange">{stats.fields} 个字段</Tag>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1200}
      footer={null}
      bodyStyle={{ padding: 0 }}
    >
      <Tabs
        defaultActiveKey={data.folders[0]?.id}
        tabPosition="left"
        style={{ minHeight: 500 }}
      >
        {data.folders.map(folder => (
          <TabPane
            tab={
              <Space direction="vertical" size={0}>
                <span style={{ fontWeight: 500 }}>{folder.name}</span>
                {folder.description && (
                  <span style={{ fontSize: 12, color: '#999' }}>
                    {folder.description}
                  </span>
                )}
              </Space>
            }
            key={folder.id}
          >
            <div style={{ padding: '24px 24px 24px 0' }}>
              {folder.groups && folder.groups.length > 0 ? (
                folder.groups.map(group => (
                  <FormRenderer
                    key={group.id}
                    group={group}
                    folderId={folder.id}
                  />
                ))
              ) : (
                <Empty
                  description="该访视下暂无表单"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </div>
          </TabPane>
        ))}
      </Tabs>

      {/* 元信息 */}
      {data.meta && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 24px',
          borderTop: '1px solid #f0f0f0',
          background: '#fafafa',
          fontSize: 12,
          color: '#666'
        }}>
          <Space split={<span>|</span>}>
            <span>ID: {data.meta.$id}</span>
            <span>版本: {data.meta.version}</span>
            <span>项目: {data.meta.projectId}</span>
            {data.meta.createdAt && (
              <span>创建时间: {new Date(data.meta.createdAt).toLocaleString()}</span>
            )}
          </Space>
        </div>
      )}
    </Modal>
  );
};

export default PreviewModal;
