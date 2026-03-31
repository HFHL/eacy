import os
import re
import json
import hashlib
from google.adk.agents import Agent, BaseAgent, ParallelAgent, SequentialAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.apps.app import App
from google.adk.events import Event
from google.adk.models.lite_llm import LiteLlm
from google.genai import types as genai_types
import litellm

# ==========================================
# 全局防并发限流配置 (拦截 429 Error 并自动退避延时再试，把 TPS 消化在 50 以内)
# ==========================================
litellm.num_retries = 6 
litellm.retry_policy = "exponential_backoff_retry"
litellm.request_timeout = 180



def _parse_json_from_text(text: str) -> dict:
    """从 LLM 返回的可能带 markdown 包裹的文本中提取 JSON"""
    if not text:
        return {}
    # 如果是 dict 类型直接返回
    if isinstance(text, dict):
        return text
    s = str(text).strip()
    # 尝试直接解析
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        pass
    # 尝试提取 ```json ... ``` 或 ``` ... ``` 代码块
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', s, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except (json.JSONDecodeError, TypeError):
            pass
    # 尝试提取第一个 { ... } 块
    match = re.search(r'(\{.*\})', s, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except (json.JSONDecodeError, TypeError):
            pass
    return {}

import time
import asyncio
import redis

# 连接本地 Redis
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# ==========================================
# 基于 Redis 的全局严格时间间隔限流器 (跨 Celery Worker)
# ==========================================
class RedisIntervalLimiter:
    def __init__(self, interval: float, lock_key: str = "llm_global_interval_lock"):
        self.interval = interval
        self.lock_key = lock_key

    async def acquire(self):
        """
        尝试获取一个有效期为 interval 的 Redis 锁。
        如果获取到了，代表此间隔段内本进程被允许发请求；
        否则被其他 Worker 抢走了，就睡眠重试，直到下一个间隔。
        """
        while True:
            # px (毫秒) 为强制定制的冷却间隔
            success = redis_client.set(self.lock_key, "1", nx=True, px=int(self.interval * 1000))
            if success:
                return
            await asyncio.sleep(0.5)

# 强行设置：所有大模型请求之间，全局跨进程严格执行至少 2.0 秒间隔
global_rate_limiter = RedisIntervalLimiter(interval=2.0)

class RateLimitedLiteLlm(LiteLlm):
    """一个注入了 TPS 拦截器的 LiteLlm 装饰类"""
    async def generate_content_async(self, llm_request, stream=False):
        await global_rate_limiter.acquire()
        async for chunk in super().generate_content_async(llm_request, stream):
            yield chunk

def get_llm_model():
    model_name = os.getenv("OPENAI_MODEL", "MiniMax-M2.7")
    api_base = os.getenv("OPENAI_API_BASE_URL", "https://api.minimaxi.com/v1")
    api_key = os.getenv("OPENAI_API_KEY", "")
    
    return RateLimitedLiteLlm(
        model=f"openai/{model_name}",
        api_base=api_base,
        api_key=api_key
    )



# ==========================================
# 阶段 1: Triage Agent (摘要与表单路由分发)
# ==========================================
triage_agent = Agent(
    name="triage_agent",
    model=get_llm_model(), 
    instruction="""你是一个医疗文档架构与数据录入分流专家。
请仔细阅读接下来发送给你的【OCR 结构化文档】（JSON 格式，每个块含 block_id、text、page_id），以及可填报的【CRF(临床研究表单)目录】。

你的唯一任务是基于这份文档的内容，精准判定该文档对目录中的哪些表单有填报价值。

【严格输出要求】：
你必须且只能输出一个纯 JSON 对象，不要输出任何其他文字或 Markdown 格式标记。
JSON 格式如下：
{"summary": "文档摘要...", "matched_forms": ["表单名称1", "表单名称2"]}

字段说明：
- summary: 一份关于该医疗文档特征与核心发现的医疗摘要。
- matched_forms: 基于文档内容，从提供的CRF目录中命中的表单名称列表（必须精确匹配目录里的名称）。如果没有命中任何表单则填空数组。
""",
    output_key="routing_state"
)

# ==========================================
# 阶段 2: 动态表单抽取 Agent 工厂
# ==========================================
def create_form_extraction_agent(form_name: str, form_schema: dict, index: int = 0) -> Agent:
    schema_str = json.dumps(form_schema, ensure_ascii=False, indent=2)
    # ADK Agent name 必须是 ASCII 字符，不能包含中文
    safe_name = f"extract_form_{index}"
    instruction = f"""你是临床数据结构化定向提取专家。
当前你需要精准填报的子表单是：【{form_name}】。

以下是该表单的严格数据要求（Schema），内部包含了具体的字段名 (name)、数据类型 (type)、允许的填报值 (enum)、是否必填 (required)：
{schema_str}

【输入说明】：
你的输入是 OCR 结构化 JSON，每个文本块含有 block_id（如 B0, B1, B2...）与对应的文本内容。

【严格输出与溯源要求（非常重要）】：
1. **你必须且只能输出一个纯 JSON 对象**，不要输出任何文字或 Markdown。
2. **根节点必须是 Schema 里的最外层字段集合！**。JSON 对象最外层的 Key 只能是 Schema 中顶层 `fields` 的 `name`。如果某字段是 `table` 或 `multirow`，它的内部子字段必须严格嵌套作为它的 Value，**绝对禁止把子字段扁平化提取到最外层！**
3. 绝对禁止常识推理：所有字段的值必须【直接、原封不动地从给定的 OCR 文本中提取】。如果不包含某字段信息，将其置空或跳过，**绝不允许捏造**。
4. 坐标追溯 (source_blocks)：
   - 提取的每个原子字段都必须是一个对象，格式为 {{"value": "提取的值", "source_blocks": ["B1", "B2"]}}。
   - 严禁伪造 block_id，如果没依据就为空。
5. **禁止生成空嵌套结构**：遇到表格（table）或多行分组（multirow）类型时，如果文档中没有数据，返回空数组 `[]`！绝对禁止为了凑格式而回传只含空字符串的字典（禁止类似 `"联系方式": [{{"联系电话": "", "出生地": ""}}]`）。

正确的数据输出格式范例：
{{
  "基本信息": {{"value": "张三", "source_blocks": ["B2"]}},
  "血常规表格": [
    {{
      "白细胞": {{"value": "3.5", "source_blocks": ["B4"]}},
      "红细胞": {{"value": "4.2", "source_blocks": ["B5"]}}
    }}
  ]
}}
"""
    # output_key 用中文表单名
    return Agent(
        name=safe_name,
        model=get_llm_model(),
        instruction=instruction,
        output_key=f"extracted_{form_name}"
    )


def create_form_repair_agent(form_name: str, form_schema: dict,
                             original_output: dict, errors: list,
                             index: int = 0) -> Agent:
    """
    构建修复 Agent：将原始输出 + 验证错误一并传给 LLM，要求修正后重新返回。
    """
    schema_str = json.dumps(form_schema, ensure_ascii=False, indent=2)
    original_str = json.dumps(original_output, ensure_ascii=False, indent=2)
    errors_str = "\n".join(f"  - {e}" for e in errors)

    safe_name = f"repair_form_{index}"
    instruction = f"""你是临床数据结构化修复专家。

你上一轮对表单【{form_name}】的提取输出 **未通过结构验证**。

## 原始输出
{original_str}

## 验证错误
{errors_str}

## 该表单的 Schema 定义
{schema_str}

## 修复要求
1. 请严格按照 Schema 定义修正上述输出中的所有错误。
2. 每个标量字段必须为 {{"value": "...", "source_blocks": ["B1", ...]}} 格式。
3. 表格/多行字段必须为数组，内部每行的子字段也必须为标量格式。
4. 禁止在根层放置不属于 Schema 的键。
5. 禁止全空占位行。
6. 只输出修正后的纯 JSON 对象，不要输出任何解释文字或 Markdown。
"""
    return Agent(
        name=safe_name,
        model=get_llm_model(),
        instruction=instruction,
        output_key=f"repaired_{form_name}"
    )

# ==========================================
# 阶段 2: 动态路由引擎 (读取分发结果，产出并发抽取任务)
# ==========================================
class DynamicExtractionRouter(BaseAgent):
    """
    一个动态的中间枢纽，它不会直接发大模型请求，而是读取 Triage 写入的态(routing_state)，
    实时生成 N 个指向命中表单的子 Agent，并将这些 Agent 打包成并行执行队列触发。
    """
    def __init__(self, **kwargs):
        super().__init__(name="extraction_router", **kwargs)
    async def _run_async_impl(self, ctx: InvocationContext):
        routing_raw = ctx.session.state.get("routing_state")
        if not routing_raw:
            yield Event(
                author=self.name,
                content=genai_types.Content(role="model", parts=[genai_types.Part.from_text(text="No routing state found.")])
            )
            return

        # 手动解析 routing_state（可能是纯文本/markdown 包裹的 JSON）
        if isinstance(routing_raw, dict):
            routing_data = routing_raw
        else:
            routing_data = _parse_json_from_text(str(routing_raw))
        
        matched_forms = routing_data.get("matched_forms", [])
        crf_catalog = ctx.session.state.get("crf_catalog", {})
        
        extraction_agents = []
        for idx, form_name in enumerate(matched_forms):
            if form_name in crf_catalog:
                form_schema = crf_catalog[form_name]
                sub_agent = create_form_extraction_agent(form_name, form_schema, index=idx)
                extraction_agents.append(sub_agent)
                
        if not extraction_agents:
            yield Event(
                author=self.name,
                content=genai_types.Content(role="model", parts=[genai_types.Part.from_text(text=f"No valid form definitions found for matches: {matched_forms}")])
            )
            return
            
        # 改为串行引擎，避免瞬时并发过高触发 MiniMax Token Plan 的 429 RateLimitError
        sequential_runner = SequentialAgent(
            name="sequential_extractor", 
            sub_agents=extraction_agents
        )
        
        async for event in sequential_runner.run_async(ctx):
            yield event

# ==========================================
# 顶层 App 包装
# ==========================================
crf_extraction_pipeline = SequentialAgent(
    name="crf_extraction_pipeline",
    sub_agents=[triage_agent, DynamicExtractionRouter()]
)

crf_app = App(
    name="eacy_crf_extraction", 
    root_agent=crf_extraction_pipeline
)
