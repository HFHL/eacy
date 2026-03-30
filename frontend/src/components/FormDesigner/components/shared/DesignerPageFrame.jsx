import React from 'react'
import { Card, Row, Col, Button } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'

const DesignerPageFrame = ({
  backLabel = '返回',
  onBack,
  headerContent = null,
  actions = null,
  children
}) => {
  return (
    <div
      className="page-container fade-in"
      style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 88px)', minHeight: 600, padding: 16 }}
    >
      <Card size="small" style={{ marginBottom: 16, flexShrink: 0 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
              {backLabel}
            </Button>
          </Col>
          <Col flex={1}>
            {headerContent}
          </Col>
          <Col>
            {actions}
          </Col>
        </Row>
      </Card>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

export default DesignerPageFrame
