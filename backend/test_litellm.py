import os
import litellm
from dotenv import load_dotenv

load_dotenv()

model_name = os.getenv("OPENAI_MODEL", "MiniMax-M2.7")
api_base = os.getenv("OPENAI_API_BASE_URL", "https://api.minimaxi.com/v1")
api_key = os.getenv("OPENAI_API_KEY", "")

prompt = """你是医疗文档匹配专家。你需要判断哪些候选文档最可能包含指定 CRF 表单所需的数据。

## 当前 CRF 表单
名称: 健康情况
描述: 该表单【健康情况】需要提取以下信息: 既往高血压, 既往糖尿病。请从最相关的医疗文档中获取。
字段列表:
  - 既往高血压 (text)
  - 既往糖尿病 (text)

## 候选文档列表
1. [未知] 化验报告.pdf
2. [病历] 首次病程记录 (内科)

## 任务
请判断哪些文档最可能包含上述表单字段所需的数据。按相关度从高到低排序。
如果没有文档包含相关数据，返回空数组。

## 输出格式
只输出纯 JSON，不要输出其他文字:
{"matched_doc_indices": [2], "reasoning": "简要说明匹配原因"}

注意: matched_doc_indices 中的数字对应文档列表中的编号（从1开始）。"""

print(f"Calling litellm... model=openai/{model_name}")
try:
    response = litellm.completion(
        model=f"openai/{model_name}",
        api_base=api_base,
        api_key=api_key,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    print("RESPONSE:")
    print(response)
    print(f"CONTENT: '{response.choices[0].message.content}'")
except Exception as e:
    print(f"ERROR: {e}")
