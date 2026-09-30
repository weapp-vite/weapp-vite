import type { ModelChunk } from '@weapp-agent/core'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { expect, it } from 'vitest'
import { AiSdkAdapter, createModel, toModelMessages } from '../src/index.js'

it.each(['openai.responses', 'anthropic.messages'])(
  'normalizes %s text, tools and token usage without executing tools',
  async (provider) => {
    const model = new MockLanguageModelV4({
      provider,
      doStream: {
        stream: simulateReadableStream({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text' },
            { type: 'text-delta', id: 'text', delta: 'Hello' },
            { type: 'text-end', id: 'text' },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'read_file',
              input: '{"path":"page.ts"}',
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
              usage: {
                inputTokens: {
                  total: 10,
                  noCache: 10,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
              },
            },
          ],
        }),
      },
    })
    const adapter = new AiSdkAdapter(provider, model)
    const chunks: ModelChunk[] = []
    for await (const chunk of adapter.stream({
      system: 'test',
      messages: [{ role: 'user', text: 'read' }],
      tools: [
        {
          name: 'read_file',
          description: 'read',
          schema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
      ],
      signal: new AbortController().signal,
    })) {
      chunks.push(chunk)
    }
    expect(chunks).toContainEqual({ type: 'text', text: 'Hello' })
    expect(chunks).toContainEqual({
      type: 'call',
      call: { id: 'call-1', name: 'read_file', input: { path: 'page.ts' } },
    })
    expect(chunks).toContainEqual({
      type: 'usage',
      inputTokens: 10,
      outputTokens: 5,
    })
    expect(model.doStreamCalls).toHaveLength(1)
  },
)
it('surfaces stream errors instead of presenting an empty success', async () => {
  const adapter = new AiSdkAdapter(
    'test',
    new MockLanguageModelV4({
      doStream: {
        stream: simulateReadableStream({
          chunks: [{ type: 'error', error: new Error('provider unavailable') }],
        }),
      },
    }),
  )
  await expect(
    (async () => {
      for await (const _part of adapter.stream({
        system: '',
        messages: [{ role: 'user', text: 'hi' }],
        tools: [],
        signal: new AbortController().signal,
      })) {
        /* Consume stream. */
      }
    })(),
  ).rejects.toThrow('provider unavailable')
})
it('preserves call identities, image inputs and tool errors across protocol conversion', () => {
  const mapped = toModelMessages([
    {
      role: 'user',
      text: 'reference',
      images: [{ type: 'image', data: 'base64', mediaType: 'image/png' }],
    },
    {
      role: 'assistant',
      text: '',
      calls: [{ id: 'x', name: 'read', input: {} }],
    },
    {
      role: 'tool',
      callId: 'x',
      name: 'read',
      error: true,
      result: { text: 'missing' },
    },
  ])
  expect(JSON.stringify(mapped)).toContain('image/png')
  expect(mapped[2]).toMatchObject({
    role: 'tool',
    content: [
      { toolCallId: 'x', output: { type: 'error-text', value: 'missing' } },
    ],
  })
})
it('uses only explicit provider credentials and requires a compatible endpoint', () => {
  expect(() => createModel({ provider: 'openai', name: 'test' }, {})).toThrow(
    'OPENAI_API_KEY',
  )
  expect(() =>
    createModel({ provider: 'anthropic', name: 'test' }, {}),
  ).toThrow('ANTHROPIC_API_KEY')
  expect(() =>
    createModel(
      { provider: 'openai-compatible', name: 'test' },
      { OPENAI_API_KEY: 'test' },
    ),
  ).toThrow('baseURL')
  expect(
    createModel(
      { provider: 'anthropic', name: 'test' },
      { ANTHROPIC_API_KEY: 'test' },
    ).id,
  ).toBe('anthropic/test')
})
