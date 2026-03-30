# EACY 文档流转与状态机映射设计

> 本文档用于规范前端 UI 呈现与后端 PostgreSQL 数据表 `documents` 之间生命周期的映射协议。

## ✨ 1. 流转状态机设计原则
整个医疗文档 AI 抽取的流程涵盖了【文件直传】【机器识别】【AI抽取】【自动引流规则匹配】【入组合规核验】等多个繁杂异步长链路。核心设计原则为：
* **后端状态原子化**：`Document.status` 字段保持高粒度的大写状态常量，记录引擎真实的物理/网络阶段。
* **前端展示聚合化**：前端统一封装一套 `Badge` 徽标聚合映射逻辑，过滤掉技术语言，向使用系统的三甲医院入组管理医生透出清晰业务动作（如：解析中、等待抽取）。

---

## 🏗️ 2. 后端数据模型 (Document.status) 常量定义
*(见: `/eacy/backend/app/models/document.py`)*

| 数据库常量 (`Document.status`) | 代表含义 | 下一步触发机制 |
|:---|:---|:---|
| `PENDING` | 等待操作（用户刚拿到上传凭证，还未开始推流） | 前端完成上传后自动回调触发 |
| `UPLOADING` | 上传进行时 | 前后端交互极快，多数情况被直接跳过 |
| `UPLOAD_FAILED` | 上传中断或网络连接失败 | 用户端重试或超时清理 |
| `METADATA_EXTRACTING` | **正在进行 TextIn OCR 识别和结构化信息大模型抽取** | Celery Worker 监听后自动进入 |
| `METADATA_FAILED` | OCR 解析失败 / 大模型返回崩溃或鉴权失败 | 产生异常溯源日志，打回列表由人工重试 |
| `COMPLETED` | OCR 识别以及结构化解析成功完成 | 进入高置信自动入组或进入人工 CRF 核验队列 |

---

## 🎨 3. 前端 UI 组件状态字典映射
*(见: `/eacy/frontend/src/pages/AIProcessing.jsx`)*

前台文件列表使用了一个自定义封装的多节点带进度指示器的组件 `StatusProgressBar` 和一个 Badge `TaskStatusBadge`。

为了与后端的定义耦合兼容，前端的展示引擎采用了如下映射关系表：

| 前端渲染字典 Key (status) | 进度条高亮节点 | Badge 标签文本显示 | 颜色主题 | 对应后端状态 (同步建议) |
|:---|::---:|:---|:---:|:---|
| `uploaded` / `PENDING` | `1/5` | **待解析** | Default (灰) | 暂存态 (无/极少数卡死) |
| `parsing` / `METADATA_EXTRACTING` | `1/5 (流动)` | **解析中** | Processing (旋转等待蓝) | `METADATA_EXTRACTING` |
| `parsed` | `2/5` | **等待抽取** | Blue | （未来解耦 TextIn 和 LLM 时的细分预留）|
| `extracted` | `3/5` | **抽取完成** | Blue | 此处已拿到 LLM 返回 JSON |
| `ai_matching` | `3/5 (流动)` | **匹配中** | Processing (旋转等待蓝) | 触发基于规则逻辑的病种 CRF 模板映射 |
| `pending_confirm_review` | `4/5` | **有候选推荐** | Orange (警告黄) | 置信度普通，强制医生弹窗介入确认 |
| `auto_archived` | `4/5` | **高置信引流** | Cyan (青亮) | 强匹配通过自动关联规则 |
| `archived` / `COMPLETED` | `5/5 (满格)` | **已归档** | Success (绿) | `COMPLETED` |
| `parse_failed` / `METADATA_FAILED` | `1/5 (标红)` | **解析失败**| Error (红) | `METADATA_FAILED` |
| `UPLOAD_FAILED` | `1/5 (标红)` | **上传失败**| Error (红) | `UPLOAD_FAILED` |

> **📝 开发者注意 (Todo):**
> 目前前后端字典大小写属于半分离状态。前端的 `AIProcessing.jsx` 当收到实际的真实后端数据（如：`METADATA_EXTRACTING` 大写常量）时，由于字典表内只填写了 `parsing` 这个小写旧 Mock 字段，可能会发生 Fallback（展示丑陋的原始英文）。后续提交代码时应当把大写常量混入前端的 `map` 字典。

---

## 🛣️ 4. 完整的处理进度链条 (`STAGE_LABELS`)
该链条对应了列表界面的扁平多段进度条：

**(1) 上传** ➞ **(2) 识别 (OCR)** ➞ **(3) 抽取 (LLM)** ➞ **(4) 匹配 (Rules)** ➞ **(5) 归档 (DB)**
