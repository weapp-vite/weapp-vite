import type {
  AgentConfig,
  Message,
  ModelAdapter,
  ModelChunk,
  ModelRequest,
} from '@weapp-agent/core'
import type { LanguageModel, ModelMessage, ToolSet } from 'ai'
import process from 'node:process'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { jsonSchema, streamText, tool } from 'ai'

export function toModelMessages(messages: Message[]): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    if (message.role === 'user') {
      return {
        role: 'user',
        content: [
          { type: 'text', text: message.text },
          ...(message.images ?? []).map(image => ({
            type: 'image' as const,
            image: image.data,
            mediaType: image.mediaType,
          })),
        ],
      }
    }
    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        content: [
          ...(message.text
            ? [{ type: 'text' as const, text: message.text }]
            : []),
          ...(message.calls ?? []).map(call => ({
            type: 'tool-call' as const,
            toolCallId: call.id,
            toolName: call.name,
            input: call.input,
          })),
        ],
      }
    }
    const text
      = message.result.data === undefined
        ? message.result.text
        : `${message.result.text}\n${JSON.stringify(message.result.data)}`
    return {
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: message.callId,
          toolName: message.name,
          output: message.result.images?.length
            ? {
                type: 'content',
                value: [
                  { type: 'text', text },
                  ...message.result.images.map(image => ({
                    type: 'file' as const,
                    data: { type: 'data' as const, data: image.data },
                    mediaType: image.mediaType,
                  })),
                ],
              }
            : { type: message.error ? 'error-text' : 'text', value: text },
        },
      ],
    }
  })
}
export class AiSdkAdapter implements ModelAdapter {
  constructor(
    readonly id: string,
    private readonly model: LanguageModel,
  ) {}

  async* stream(request: ModelRequest): AsyncIterable<ModelChunk> {
    const tools: ToolSet = Object.fromEntries(
      request.tools.map(t => [
        t.name,
        tool({ description: t.description, inputSchema: jsonSchema(t.schema) }),
      ]),
    )
    // No execute functions: the SDK cannot run tools or retry side effects.
    const result = streamText({
      model: this.model,
      system: request.system,
      messages: toModelMessages(request.messages),
      tools,
      abortSignal: request.signal,
      maxRetries: 2,
      onError: () => {},
      maxOutputTokens: 8192,
    })
    for await (const part of result.stream) {
      if (part.type === 'text-delta') {
        yield { type: 'text', text: part.text }
      }
      if (part.type === 'tool-call') {
        yield {
          type: 'call',
          call: { id: part.toolCallId, name: part.toolName, input: part.input },
        }
      }
      if (part.type === 'finish') {
        yield {
          type: 'usage',
          inputTokens: part.totalUsage.inputTokens ?? 0,
          outputTokens: part.totalUsage.outputTokens ?? 0,
        }
      }
      if (part.type === 'error') {
        throw part.error
      }
      if (part.type === 'abort') {
        throw new Error('Model request cancelled')
      }
    }
  }
}
export function apiKeyVariable(config: AgentConfig['model']): string {
  return (
    config.apiKeyEnv
    ?? (config.provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY')
  )
}
export function createModel(
  config: AgentConfig['model'],
  environment: NodeJS.ProcessEnv = process.env,
): ModelAdapter {
  const variable = apiKeyVariable(config)
  const apiKey = environment[variable]
  if (!apiKey) {
    throw new Error(
      `Set ${variable} in your environment. Credentials are never read from other agents or stored in project config.`,
    )
  }
  let model: LanguageModel
  if (config.provider === 'anthropic') {
    model = createAnthropic({ apiKey, baseURL: config.baseURL })(config.name)
  }
  else if (config.provider === 'openai-compatible') {
    if (!config.baseURL) {
      throw new Error('openai-compatible requires model.baseURL')
    }
    model = createOpenAICompatible({
      name: 'weapp-compatible',
      apiKey,
      baseURL: config.baseURL,
    })(config.name)
  }
  else {
    model = createOpenAI({ apiKey, baseURL: config.baseURL }).responses(
      config.name,
    )
  }
  return new AiSdkAdapter(`${config.provider}/${config.name}`, model)
}
