# 20260327 Prompt 配置说明

本目录用于维护一套面向医疗文档结构化抽取的模块化 Prompt 配置。目标不是把提示词写死在代码里，而是把分类规则、抽取规则、字段定义和输出契约拆分为独立 JSON，再通过脚本组装成最终可投喂大模型的 Prompt package。

当前目录主要用于配置设计、离线组装与人工校验，尚未直接接入生产链路。

## 目录结构

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `metadata_fields.json` | 字段定义层 | 定义当前抽取任务需要输出哪些字段，以及每个字段的类型、必填性、枚举、格式和抽取说明 |
| `document_types.json` | 分类知识层 | 定义文档主类型、子类型、分类依据与子类型判别 guidance |
| `extraction_rules.json` | 通用规则层 | 定义跨任务通用的系统角色、禁止事项、缺失值策略、证据要求、规范化规则和医疗安全约束 |
| `output_format.json` | 输出契约层 | 定义 `result + audit` 双结构、字段级审计最小要求和模式示例 |
| `build_prompt_package.py` | 组装脚本 | 读取上述 4 个 JSON，拼装 `system_prompt`、`user_payload` 和 `messages` |
| `prompt_package.generated.json` | 组装产物样例 | 当前目录配置实际组装后的 JSON 文档，便于人工查看和校验 |

## 设计思路

### 1. 配置分层

这套设计把 Prompt 拆成 4 层，每层只负责一个问题：

- `metadata_fields.json` 回答“当前任务要抽什么”
- `document_types.json` 回答“文档如何分类”
- `extraction_rules.json` 回答“抽取时必须遵守什么原则”
- `output_format.json` 回答“最终 JSON 应该长什么样”

这样做的好处是：

- 调整字段时，不需要修改系统规则
- 调整分类逻辑时，不需要改脚本
- 未来替换为其他抽取单元时，可以复用同一套通用规则和输出契约
- 便于把生成后的 Prompt package 单独导出并人工审查

### 2. Prompt 组装策略

脚本不是直接把 4 个 JSON 原样拼接，而是做了一层“适合大模型理解”的重组：

- `system_prompt`
  - 主要来自 `extraction_rules.json`
  - 同时补充 `output_format.json` 中顶层契约与审计最小要求
  - 最终是纯文本系统提示词，强调规则、边界和输出纪律
- `user_payload`
  - 主要包含当前任务字段列表、输出格式说明和文档输入
  - 如字段列表中包含 `文档类型` 或 `文档子类型`，会自动附加 `classification_reference`
  - 最终会被序列化成 JSON 字符串，作为 user message 的内容

最终产物是一个标准聊天消息结构：

```json
{
  "messages": [
    {
      "role": "system",
      "content": "<系统提示词文本>"
    },
    {
      "role": "user",
      "content": "<JSON 字符串化后的任务载荷>"
    }
  ]
}
```

## 各文件详细说明

### metadata_fields.json

该文件定义“当前这次抽取任务的字段集合”。

每个字段通常包含：

- `name`：字段名
- `type`：字段类型，如 `string`、`integer`、`array`
- `required`：是否必须在结果中显式输出
- `description`：给大模型的字段级抽取指令
- 可选补充：
  - `enum`
  - `format`
  - `minimum`
  - `maximum`
  - `items`

当前文件的几个关键设计点：

- `文档类型`、`文档子类型` 是必填字段
- `文档摘要` 是必填字段，但它不是标题提取，而是服务后续 Agent 路由判断的高信息密度摘要
- 其他字段即使缺失，也应通过 `null` 体现，而不是猜测补全
- 数组字段支持嵌套对象定义，例如 `唯一标识符`

适合修改这个文件的场景：

- 新增或删除抽取字段
- 调整某个字段的抽取边界
- 为某个字段补充更强的枚举或格式约束

不适合在这里做的事情：

- 写全局禁止事项
- 写输出顶层结构要求
- 写具体文档分类体系

### document_types.json

该文件定义文档分类知识库。

顶层包含：

- `$description`
- `classification_basis`
- `doc_types`

每个主类型包含：

- `name`
- `description`
- 可选 `default_subtype`
- `subtypes`

每个子类型包含：

- `name`
- `guidance`

这里使用 `guidance` 而不是 `prompt`，是为了表达“这是对子类型判别的指导描述”，而不是一段可直接拼接的自由提示词文本。

当前分类设计强调：

- 先判主类型，再判子类型
- 以文档主体内容和正文结构为准
- 标题、栏目名、关键词是辅助，不是唯一依据
- 对冲突文种使用更强的优先级裁决

只有当任务字段中包含 `文档类型` 或 `文档子类型` 时，脚本才会把该文件压缩后注入到 `user_payload.classification_reference`，避免对无关任务造成冗余干扰。

### extraction_rules.json

该文件是通用抽取规则层，不绑定某一类具体字段。

主要包含：

- `system_role`
- `core_principles`
- `forbidden_actions`
- `missing_value_policy`
- `evidence_policy`
- `normalization_policy`
- `medical_safety_policy`
- `output_contract`
- `audit_policy`

它解决的是“模型应该如何抽”，而不是“当前具体抽什么”。

几个核心原则：

- 真实性优先于完整性
- 明确证据优先于推断补全
- `result` 与 `audit` 分离
- 高风险医疗字段必须依赖显式证据
- `page_idx` 由大模型输出，表示 `audit.raw` 所在页；无法判断时输出 `0`
- `document_id` 更适合由后处理流程注入

未来如果把更复杂的 schema 拆成独立抽取单元，这一层仍然可以复用。

### output_format.json

该文件用于约束输出结构，而不是定义业务字段本身。

主要包含：

- `top_level_contract`
- `result_policy`
- `audit_policy`
- `canonical_example`
- `pattern_examples`

几个关键点：

- 顶层固定为 `result` 和 `audit`
- `audit` 默认采用简单扁平结构：`audit.fields`
- `canonical_example` 使用占位符字段，而不是固定业务字段，避免误导模型
- `pattern_examples` 分别说明数组字段、缺失值和复杂字段组的常见结构模式

这意味着：

- 真正的字段集合来自 `metadata_fields.json`
- `output_format.json` 只负责说明“结构怎么组织”

## build_prompt_package.py 组装逻辑

脚本的职责是把配置文件转成一个便于调用和检查的 Prompt package。

主要流程如下：

1. 读取 4 个配置文件
2. 构建 `system_prompt`
3. 构建 `user_payload`
4. 生成 `messages`
5. 以 JSON 输出到标准输出或指定文件

### 关键函数

#### `load_json(file_name)`

读取当前目录下的 JSON 配置文件。

#### `compact_field_definition(field)`

把字段定义压缩为更适合传给模型的结构，只保留与抽取相关的关键信息。

#### `compact_document_types(document_types)`

把分类体系压缩为模型真正需要的判别信息，尤其保留：

- 主类型名称
- 主类型描述
- 子类型名称
- 子类型 `guidance`

#### `build_system_prompt(extraction_rules, output_format)`

把通用抽取规则和输出契约组装成系统提示词文本。输出形式是自然语言段落，而不是 JSON。

原因是：

- 规则型内容使用文本更符合大模型对系统指令的理解方式
- 列表化文本更容易强调优先级和禁止事项
- 可以减少模型把“规则 JSON”误当成要模仿输出的数据结构

#### `build_user_payload(metadata_fields, document_types, output_format, document_text, document_chunks)`

构造任务载荷，包含：

- `task`
  - `task_name`
  - `task_scope`
  - `field_definitions`
- `output_format`
- `document_input`
- 可选 `classification_reference`

#### `build_document_input(document_text, document_chunks)`

支持两种输入模式：

- `plain_text`
- `chunked`

当传入 `document_chunks` 时，优先输出 `chunked` 模式；否则输出 `plain_text` 模式。

#### `build_prompt_package(document_text=None, document_chunks=None)`

返回最终 Prompt package：

```json
{
  "config_version": "20260327",
  "config_dir": "<当前目录绝对路径>",
  "messages": [
    {"role": "system", "content": "<system_prompt>"},
    {"role": "user", "content": "<user_payload JSON字符串>"}
  ],
  "system_prompt": "<system_prompt>",
  "user_payload": { }
}
```

其中：

- `messages` 用于实际投喂聊天模型
- `system_prompt` 和 `user_payload` 额外保留出来，便于人工检查

## 生成与使用

### 1. 直接打印 Prompt package

在当前目录执行：

```bash
python build_prompt_package.py
```

默认会把组装结果打印到标准输出。

### 2. 输出到 JSON 文件

```bash
python build_prompt_package.py --output prompt_package.generated.json
```

这也是当前目录中 `prompt_package.generated.json` 的来源。

### 3. 指定纯文本输入文档

```bash
python build_prompt_package.py --document-file sample_document.txt --output prompt_package.generated.json
```

此时输出中的 `document_input` 结构类似：

```json
{
  "input_mode": "plain_text",
  "text": "<文档全文>"
}
```

### 4. 指定分块输入文档

```bash
python build_prompt_package.py --chunks-file sample_chunks.json --output prompt_package.generated.json
```

`sample_chunks.json` 需要是 JSON 数组，例如：

```json
[
  {
    "source_id": "chunk-1",
    "page_idx": 1,
    "text": "第一页文本"
  },
  {
    "source_id": "chunk-2",
    "page_idx": 2,
    "text": "第二页文本"
  }
]
```

脚本会将其组装为：

```json
{
  "input_mode": "chunked",
  "chunks": [
    {
      "source_id": "chunk-1",
      "page_idx": 1,
      "text": "第一页文本"
    }
  ]
}
```

## prompt_package.generated.json 如何看

建议重点检查以下 4 个区域：

### 1. `messages[0].content`

这是最终系统提示词，重点看：

- 是否覆盖核心原则、禁止事项、证据要求、缺失值策略
- 是否明确只允许输出 `result + audit`
- 是否清楚表达 `page_idx` 的含义

### 2. `user_payload.task.field_definitions`

这是当前任务字段清单，重点看：

- 字段名是否完整
- `required` 是否符合预期
- 枚举、格式、类型是否正确
- `description` 是否足够可执行且不会诱导模型瞎猜

### 3. `user_payload.classification_reference`

仅在需要分类时存在，重点看：

- 主类和子类是否齐全
- 子类是否使用 `guidance`
- 分类依据是否足够判别式

### 4. `user_payload.output_format`

重点看：

- 是否仍然保持泛化，不夹带固定业务字段
- `audit.fields` 的约定是否清晰
- 示例是否只表达结构模式，不表达业务答案

## 推荐校验清单

人工审阅 Prompt package 时，建议按下面顺序检查：

1. `system_prompt` 是否要求“只基于证据抽取”
2. `result` 是否只允许输出当前字段列表
3. `audit` 是否明确要求 `raw` 和 `value`
4. `page_idx` 是否被保留为模型输出项
5. `document_id` 是否仍被描述为后处理注入项
6. `document_types.json` 是否只在分类任务中注入
7. `canonical_example` 是否仍为占位符模式
8. `文档摘要` 是否保持“路由摘要”定位，而不是退回“标题提取”

## 维护建议

### 什么时候改 metadata_fields.json

- 抽取字段变化
- 某个字段的说明不够稳健
- 需要新增枚举、格式或数组子结构

### 什么时候改 document_types.json

- 主类型或子类型边界不清
- 某些文种之间容易误判
- 需要补充更强的分类裁决描述

### 什么时候改 extraction_rules.json

- 想统一增强抗幻觉策略
- 想强化审计、缺失值或规范化纪律
- 想兼容更多抽取单元，但不想改字段层

### 什么时候改 output_format.json

- 想调整 `result + audit` 的结构契约
- 想补充新的模式示例
- 想增强复杂字段组的审计表示方式

## 注意事项

- `document_types.json` 子类型说明字段已统一使用 `guidance`，如果后续有其他消费方仍读取 `prompt`，需要同步适配
- `output_format.json` 中的示例是结构示例，不是业务示例
- `page_idx` 是模型输出项，不依赖业务侧注入
- `document_id` 默认不是模型强制输出项
- 当前目录主要面向配置设计、离线组装和人工校验，不代表已经接入正式生产流程

## 当前推荐协作方式

如果其他开发者要快速理解或继续扩展，建议遵循以下顺序：

1. 先看本 README，理解每个文件的职责边界
2. 再看 `prompt_package.generated.json`，直接理解最终给模型的实际内容
3. 如需改字段，优先修改 `metadata_fields.json`
4. 如需改分类，优先修改 `document_types.json`
5. 如需改通用约束，修改 `extraction_rules.json`
6. 如需改输出模式，修改 `output_format.json`
7. 修改后重新执行 `build_prompt_package.py`，再人工复核生成产物
