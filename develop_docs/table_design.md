# EACY 数据库表结构设计文档

> **注意：** 此文档用于记录 `eacy_db` (PostgreSQL) 数据库的所有表结构设计。后续任何修改数据库结构的操作（新增表、修改字段等），**必须**同步更新此文档。

---

## 1. 用户表 (`users`)

用于存储平台用户的基本信息和认证凭据。

| 字段名称 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto Increment | - | 用户唯一标识 |
| `email` | String(120) | Unique, Not Null | - | 用户登录邮箱 |
| `name` | String(100) | Not Null | - | 用户显示名称 |
| `password_hash` | String(256) | Not Null | - | 加密后的密码哈希串 |
| `is_deleted` | Boolean | Not Null | `False` | 软删除标记 |
| `created_at` | DateTime | Not Null | `datetime.utcnow` | 账号创建时间 |

---

## 2. 文档与状态表 (`documents`)

记录病历原始文件的生命周期及元数据提取进度。

| 字段名称 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String(36) | Primary Key | `uuid4()` | 业务主键，避免自增ID被遍历 |
| `filename` | String(255) | Not Null | - | 原始文件名称 |
| `oss_url` | String(500) | Nullable | - | 上传至 OSS 后的远程地址 |
| `mime_type` | String(100) | Not Null | - | 文件格式 (如 `application/pdf`) |
| `file_size` | Integer | Nullable | - | 文件大小（字节号） |
| `status` | String(50) | Not Null | `PENDING` | 文档当前的解析阶段状态 |
| `uploader_id`| Integer | Nullable | - | 上传人ID (对接 `users.id`) |
| `is_deleted` | Boolean | Not Null | `False` | 软删除标记 |
| `created_at` | DateTime | Not Null | `utcnow` | 创建时间 |
| `updated_at` | DateTime | Not Null | `utcnow` | 最新状态的刷新时间 |

### 附：`documents.status` 状态机字典
- `PENDING`: 记录初始化，等待上传
- `UPLOADING`: 正在上传至云端 OSS
- `UPLOAD_FAILED`: 上传 OSS 失败
- `METADATA_EXTRACTING`: OCR与元数据提取进行中
- `METADATA_FAILED`: 元数据大模型提取失败
- `COMPLETED`: 提取完成，待后续 CRF 表单分发

---

## 3. 审计日志表 (`audit_logs`)

记录高价值、不可逆的人类用户操作行为（用于合规体系与溯源追踪）。

| 字段名称 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String(36) | Primary Key | `uuid4()` | 业务主键 |
| `user_id` | Integer | Nullable | - | 操作用户 ID |
| `action_type` | String(100) | Not Null | - | 关键动作（例如 `UPLOAD_DOCUMENT`, `CREATE_CRF_TEMPLATE`） |
| `target_type` | String(100) | Nullable | - | 作用实体类别（例如 `DOCUMENT`） |
| `target_id` | String(100) | Nullable | - | 作用实体的唯一 ID |
| `details` | JSONB | Nullable | - | 上下文 JSON 信息（IP、操作前后差异等） |
| `is_deleted` | Boolean | Not Null | `False` | 软删除 |
| `created_at` | DateTime | Not Null | `utcnow()` | 操作时间 |


## 4. 管线轨迹表 (`pipeline_traces`)

异步追踪 Agent 管线流转日志，供排查大模型幻觉与流水线故障。

| 字段名称 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String(36) | Primary Key | `uuid4()` | 轨迹独立主键 |
| `document_id` | String(36) | Not Null | - | 绑定的对应文档的 UUID |
| `stage` | String(100) | Not Null | - | 模型处理阶段（例如 `OCR_EXTRACTION`, `ROUTING`） |
| `status` | String(50) | Not Null | - | 执行节点状态（例如 `PROCESSING`, `FAILED`, `SUCCESS`） |
| `llm_payload` | JSONB | Nullable | - | 大模型 Prompt 和吐出履历 |
| `error_msg` | Text | Nullable | - | 后台抛出的 Python 或第三方接口 Traceback |
| `duration_ms` | Integer | Nullable | - | 模型全量推断耗时（毫秒） |
| `is_deleted` | Boolean | Not Null | `False` | 软删除 |
| `created_at` | DateTime | Not Null | `utcnow()` | 轨迹落库时间 |

---

## 5. 患者表 (`patients`)

电子病历夹主表，一个患者 = 一个病历夹。元数据以 JSONB 动态存储，随配置灵活变化。

| 字段名称 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | String(36) | Primary Key | `uuid4()` | 患者唯一主键 |
| `metadata_json` | JSONB | Nullable | `{}` | 患者元数据（动态字段，随 metadata_fields 配置变化） |
| `identifiers` | JSONB | Nullable | `[]` | 唯一标识符数组，用于归档匹配 |
| `document_count` | Integer | Not Null | `0` | 关联文档数量（冗余计数） |
| `is_deleted` | Boolean | Not Null | `False` | 软删除 |
| `created_at` | DateTime | Not Null | `utcnow` | 创建时间 |
| `updated_at` | DateTime | Not Null | `utcnow` | 最后更新时间 |

---

## 6. 患者-文档关联表 (`patient_documents`)

多对多关系，一个患者可有多份文档。带文档元数据快照。

| 字段名称 | 类型 | 约束 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | Integer | Primary Key, Auto Inc | - | 自增主键 |
| `patient_id` | String(36) | FK → patients.id, Not Null | - | 患者 ID |
| `document_id` | String(36) | FK → documents.id, Not Null | - | 文档 ID |
| `doc_type` | String(50) | Nullable | - | 文档类型快照 |
| `doc_subtype` | String(100) | Nullable | - | 文档子类型快照 |
| `doc_title` | String(200) | Nullable | - | 文档标题快照 |
| `doc_date` | String(30) | Nullable | - | 文档生效日期快照 |
| `source` | String(30) | Not Null | `AUTO` | 关联来源：AUTO / MANUAL |
| `is_deleted` | Boolean | Not Null | `False` | 软删除 |
| `created_at` | DateTime | Not Null | `utcnow` | 关联时间 |

> **唯一约束**: `UNIQUE(patient_id, document_id)` — 同一文档不可重复关联到同一患者

---
*上次更新时间：2026-03-28*

