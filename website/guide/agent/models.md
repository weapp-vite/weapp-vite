---
title: "模型与凭据"
description: "连接 OpenAI、Anthropic 或兼容服务。"
sidebar:
  order: 2
keywords:
  - weapp-agent
  - OpenAI
  - Anthropic
  - 模型凭据
---

## 选择模型

| Provider | 默认密钥环境变量 | 协议 |
| --- | --- | --- |
| `openai` | `OPENAI_API_KEY` | OpenAI Responses |
| `anthropic` | `ANTHROPIC_API_KEY` | Anthropic Messages |
| `openai-compatible` | `OPENAI_API_KEY` | Chat Completions 兼容接口 |

```bash
weapp-agent init --provider anthropic --model YOUR_MODEL
weapp-agent init --provider openai-compatible --model YOUR_MODEL --base-url https://your-provider.example/v1
```

上述命令用于不同项目。已有配置不会被 `init` 覆盖，请直接编辑配置。

## 配置文件

```json
{
  "version": 1,
  "model": {
    "provider": "openai",
    "name": "YOUR_MODEL",
    "apiKeyEnv": "OPENAI_API_KEY"
  },
  "maxSteps": 40,
  "timeoutMs": 600000,
  "contextCharacters": 100000,
  "verification": [],
  "mcp": []
}
```

`baseURL` 和 `apiKeyEnv` 可选。模型必须支持工具调用；使用截图时还需要图片输入能力。代理、服务提供方的功能和配额由你的环境控制。

## 数据流

源代码、任务文字和截图按任务需要发送至你选择的模型服务；文件修改、命令执行与会话保存发生在本机。产品不提供托管账号或默认遥测，也不会读取其他 agent 的登录凭据。

模型网络请求最多重试两次；模型适配层不执行工具，因此网络重试不会直接重复文件写入。流中断会结束本轮任务，使用会话恢复继续处理。
