import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Table, Input, Space, Tag, Dropdown, message, Modal } from 'antd';
import { FolderOpenOutlined, DownOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { getPatients, deletePatient } from '../api/patient';

const { Title, Text } = Typography;

const Patients = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');

  const fetchData = async (pageNum = 1, currentKeyword = keyword) => {
    setLoading(true);
    try {
      const res = await getPatients({ page: pageNum, size: 10, keyword: currentKeyword });
      const payload = res.data?.data || res.data;
      if (payload) {
        setData(payload.list || []);
        setTotal(payload.total || 0);
        setPage(payload.page || 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (value) => {
    setKeyword(value);
    fetchData(1, value);
  };

  const handleTableChange = (pagination) => {
    fetchData(pagination.current, keyword);
  };

  const openDocuments = async (record) => {
    navigate(`/patients/${record.id}`);
  };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除病历夹？',
      icon: <ExclamationCircleOutlined />,
      content: `将会永久删除患者 "${record.metadata_json?.['患者姓名'] || '未知'}" 的档案及其关联的所有文档实体，此操作不可逆！`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deletePatient(record.id);
          message.success('病历夹删除成功');
          if (data.length === 1 && page > 1) {
            setPage(page - 1);
            fetchData(page - 1, keyword);
          } else {
            fetchData(page, keyword);
          }
        } catch (err) {
          message.error(err?.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const columns = [
    {
      title: '患者姓名',
      dataIndex: ['metadata_json', '患者姓名'],
      key: 'name',
      render: (text, record) => <a onClick={() => openDocuments(record)}>{text || '未提供'}</a>,
    },
    {
      title: '性别',
      dataIndex: ['metadata_json', '患者性别'],
      key: 'gender',
      width: 80,
    },
    {
      title: '年龄',
      dataIndex: ['metadata_json', '患者年龄'],
      key: 'age',
      width: 80,
    },
    {
      title: '唯一标识',
      dataIndex: 'identifiers',
      key: 'uid',
      render: (val) => Array.isArray(val) ? val.join(', ') : '-',
    },
    {
      title: '就诊机构',
      dataIndex: ['metadata_json', '机构名称'],
      key: 'hospital',
    },
    {
      title: '归档文档数',
      dataIndex: 'document_count',
      key: 'document_count',
      align: 'center',
      render: (count) => <Tag color={count > 0 ? 'blue' : 'default'}>{count} 份</Tag>,
    },
    {
      title: '最近更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      render: (val) => val ? new Date(val).toLocaleString() : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        const items = [
          {
            key: 'view',
            label: '查看病历',
            onClick: () => openDocuments(record)
          },
          {
            key: 'delete',
            label: '删除',
            danger: true,
            onClick: () => handleDelete(record)
          }
        ];
        return (
          <Dropdown menu={{ items }} trigger={['click']}>
            <a onClick={(e) => e.preventDefault()}>
              <Space>操作 <DownOutlined /></Space>
            </a>
          </Dropdown>
        );
      },
    },
  ];

  const docColumns = [
    { title: '文档标题', dataIndex: 'doc_title', key: 'title' },
    { title: '文档类型', dataIndex: 'doc_type', key: 'type', render: t => <Tag>{t || '未知'}</Tag> },
    { title: '生效日期', dataIndex: 'doc_date', key: 'date' },
    { title: '归档时间', dataIndex: 'created_at', key: 'created', render: v => new Date(v).toLocaleString() },
  ];

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0, marginBottom: 4 }}>患者病历夹</Title>
          <Text type="secondary">集中管理系统内所有已建档的患者及其结构化病历和原始文档文件。</Text>
        </div>
        <Input.Search 
          placeholder="搜索患者姓名、标识符..." 
          allowClear
          onSearch={handleSearch}
          style={{ width: 300 }}
        />
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        rowKey="id" 
        loading={loading}
        onChange={handleTableChange}
        pagination={{
          current: page,
          total: total,
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (t) => `共 ${t} 名患者`
        }}
        style={{ flex: 1, backgroundColor: '#fff', borderRadius: 8 }}
      />
    </div>
  );
};

export default Patients;
