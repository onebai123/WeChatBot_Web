# Gemini 2.5 Pro 流式空回复修复方案

> 适用项目：WeChatBot_Web (Next.js 版)  
> 问题模型：gemini-2.5-pro（thinking 模型）  
> 影响范围：所有使用 viviai/vg 代理的渠道

---

## 一、问题描述

使用 gemini-2.5-pro 流式请求时，约 10% 概率返回空内容：
- 流式响应只有 init chunk 和 `[DONE]`，没有 content chunk
- `completion_tokens=0`，模型未输出文字
- 非流式（stream=false）请求不受影响

**根因**：代理层转发 thinking 模型的流式响应时偶尔丢失 content chunk。

---

## 二、修复内容（3个文件）

### 2.1 `src/lib/api.ts` — 空回复检测

在 `streamChatMessage` 函数末尾加空回复检测，并新增 `EmptyResponseError` 类：

```typescript
/** 空回复错误（用于触发重试） */
export class EmptyResponseError extends Error {
  constructor() {
    super('流式响应返回空内容')
    this.name = 'EmptyResponseError'
  }
}

/** 流式请求 */
export async function* streamChatMessage(params: SendChatParams): AsyncGenerator<string> {
  // ... 原有代码 ...

  const decoder = new TextDecoder()
  let buffer = ''
  let hasContent = false  // ← 新增

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (!trimmed.startsWith('data: ')) continue

      try {
        const json = trimmed.slice(6)
        const parsed = JSON.parse(json)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          hasContent = true  // ← 新增
          yield content
        }
      } catch {
        // 忽略解析错误的行
      }
    }
  }

  // ← 新增：流式结束后检测是否有内容
  if (!hasContent) {
    throw new EmptyResponseError()
  }
}
```

### 2.2 `src/components/chat/ChatContainer.tsx` — 重试逻辑

**导入新增：**
```typescript
import { streamChatMessage, sendChatMessage, EmptyResponseError } from '@/lib/api'
```

**替换流式调用部分：**

原代码：
```typescript
// 流式请求
const stream = streamChatMessage({...})
for await (const chunk of stream) {
  responseText += chunk
  updateMessage(...)
}
```

替换为：
```typescript
// 流式请求（空回复重试：第1次流式 → 第2次流式 → 第3次非流式兜底）
const chatParams = {
  messages: [...],
  model: gptConfig.model,
  maxTokens: gptConfig.maxTokens,
  temperature: gptConfig.temperature,
  apiKey: apiConfig.apiKey,
  apiBaseUrl: apiConfig.apiBaseUrl,
}

const MAX_STREAM_RETRIES = 2
let responseText = ''

// 阶段一：流式尝试（最多2次）
for (let attempt = 1; attempt <= MAX_STREAM_RETRIES; attempt++) {
  apiLog.info(`调用 API [流式]: ${gptConfig.model} (第${attempt}次)`, { url: apiConfig.apiBaseUrl })
  responseText = ''
  const stream = streamChatMessage(chatParams)

  try {
    for await (const chunk of stream) {
      responseText += chunk
      updateMessage(activePersonaId, lastMsgId || '', {
        text: responseText,
        loading: true,
      })
    }
    break // 成功
  } catch (e) {
    if (e instanceof EmptyResponseError && attempt < MAX_STREAM_RETRIES) {
      apiLog.info(`流式空回复，第${attempt}次重试...`)
      continue
    }
    if (e instanceof EmptyResponseError) {
      // 阶段二：降级非流式兜底
      apiLog.info('流式重试均为空回复，降级为非流式请求')
      try {
        const result = await sendChatMessage(chatParams)
        responseText = result.content
        updateMessage(activePersonaId, lastMsgId || '', {
          text: responseText,
          loading: true,
        })
      } catch (fallbackErr) {
        throw fallbackErr
      }
      break
    }
    throw e
  }
}
```

### 2.3 `src/lib/defaults.ts` — 增大默认 maxTokens

```typescript
export const defaultGptConfig: GptConfig = {
  model: DEFAULT_MODEL,
  maxTokens: 8192,  // 原值 3000，改为 8192
  // ...
}
```

### 2.4 `src/components/settings/SettingsModal.tsx` — 滑块范围

```typescript
// 原值：min="256" max="4096" step="256"
<input type="range" min="1024" max="16384" step="1024" value={gptConfig.maxTokens} ... />
```

---

## 三、修复原理

```
用户发消息
  ↓
第1次：流式请求 → 有内容 → 正常显示（90%概率）
  ↓ 空回复（EmptyResponseError）
第2次：流式重试 → 有内容 → 正常显示（90%概率）
  ↓ 还是空
第3次：非流式兜底 → 几乎100%有内容（测试20/20）
```

最终空回复概率：10% × 10% × ~0% ≈ **0%**

---

## 四、测试方法

### 4.1 PowerShell 流式空回复测试

```powershell
# 修改 $url 和 $key 为实际值
$url = "https://vg.v1api.cc/v1/chat/completions"
$key = "sk-your-key-here"
$max_tokens = 8192

$results = @()
for ($i = 1; $i -le 10; $i++) {
    $body = "{`"model`":`"gemini-2.5-pro`",`"messages`":[{`"role`":`"user`",`"content`":`"hi`"}],`"max_tokens`":$max_tokens,`"temperature`":0.5,`"stream`":true}"
    $headers = @{
        'Content-Type' = 'application/json'
        'Authorization' = "Bearer $key"
    }
    try {
        $response = Invoke-WebRequest -Uri $url -Method POST -Headers $headers `
            -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 60 -UseBasicParsing
        $content = ''
        $response.Content -split "`n" | ForEach-Object {
            if ($_ -match '"content":"([^"]+)"' -and $Matches[1].Length -gt 0) {
                $content += $Matches[1]
            }
        }
        $results += if ($content.Length -gt 0) { "OK" } else { "EMPTY" }
    } catch {
        $results += "ERR"
    }
}
$ok = ($results | Where-Object { $_ -eq 'OK' }).Count
Write-Host "Results: $($results -join ' | ')"
Write-Host "Success: $ok/10"
```

### 4.2 非流式对比测试

```powershell
$body = '{"model":"gemini-2.5-pro","messages":[{"role":"user","content":"hi"}],"max_tokens":8192,"temperature":0.5,"stream":false}'
$headers = @{
    'Content-Type' = 'application/json'
    'Authorization' = "Bearer $key"
}
$r = Invoke-RestMethod -Uri $url -Method POST -Headers $headers `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 60
Write-Host "Content: $($r.choices[0].message.content)"
# 非流式应该100%有内容
```

### 4.3 功能验证

修复后在浏览器中测试：
1. 打开设置面板，确认 maxTokens 滑块范围为 1024-16384
2. 设置模型为 gemini-2.5-pro
3. 连续发送 10 次 "hi"
4. 观察是否仍有空气泡（不应该有）
5. 打开浏览器 Console，查看日志是否有 "流式空回复，第X次重试..." 的记录

---

## 五、测试数据参考

| 条件 | 空回复率 |
|------|---------|
| 修复前 max_tokens=3000 | ~40% |
| 修复前 max_tokens=8192 | ~10% |
| 修复后（重试+非流式兜底） | ~0% |
| 非流式 stream=false | 0%（20/20） |

---

## 六、已验证渠道

| 渠道 | 流式空回复 | 非流式 | 修复后 |
|------|-----------|--------|--------|
| vg.v1api.cc | ~10% | 0% | ✅ |
| api.viviai.cc | ~10% | 0% | ✅ |
| yunwu.ai | 0% | 0% | ✅ |
| jieapi.com | 0% | 0% | ✅ |
| api.aabao.top | 0% | 0% | ✅ |
