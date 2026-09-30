import type { AgentConfig } from './config.js'
import type {
  Approver,
  ImageInput,
  Message,
  ModelAdapter,
  RunResult,
  SessionEvent,
  Tool,
  ToolCall,
} from './types.js'
import { z } from 'zod'
import { ApprovalRequired, redactor } from './security.js'
import { Session } from './session.js'

export interface RunOptions {
  root: string
  config: AgentConfig
  model: ModelAdapter
  tools: Tool[]
  prompt: string
  images?: ImageInput[]
  system?: string
  trusted?: boolean
  approve?: Approver
  signal?: AbortSignal
  sessionId?: string
  acknowledgeInterrupted?: boolean
  onEvent?: (event: SessionEvent) => void | Promise<void>
}
// Image bytes are not text-context tokens. Account for a bounded image cost instead.
function contextSize(messages: Message[]): number {
  return JSON.stringify(messages, (key, value) =>
    key === 'images' && Array.isArray(value)
      ? value.map(() => '[image]'.repeat(256))
      : value).length
}
export function compactMessages(
  messages: Message[],
  budget: number,
): { messages: Message[], compacted: boolean } {
  if (contextSize(messages) <= budget) {
    return { messages, compacted: false }
  }
  // Keep assistant calls and all their tool results together, including the last user request.
  const groups: Message[][] = []
  for (const message of messages) {
    if (message.role !== 'tool' || groups.length === 0) {
      groups.push([])
    }
    groups[groups.length - 1]!.push(message)
  }
  const retained: Message[][] = []
  let size = 0
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]!
    const length = contextSize(group)
    if (retained.length && size + length > budget * 0.7) {
      break
    }
    retained.unshift(group)
    size += length
  }
  const kept = retained.flat()
  const omitted = messages.slice(0, messages.length - kept.length)
  const summary = omitted
    .map((m) => {
      if (m.role === 'tool') {
        return `${m.name}: ${m.result.text.slice(0, 240)}`
      }
      return `${m.role}: ${m.text.slice(0, 500)}`
    })
    .join('\n')
    .slice(-Math.floor(budget * 0.2))
  // Clip oversized individual outputs, never discard call IDs or tool-result pairing.
  const clipped = kept.map(m =>
    m.role === 'tool'
      ? {
          ...m,
          result: {
            ...m.result,
            text: m.result.text.slice(0, Math.floor(budget * 0.25)),
          },
        }
      : m,
  )
  if (contextSize(clipped) + summary.length + 200 > budget) {
    // An indivisible call/result group can exceed the budget. Summarize the whole
    // group instead of sending orphan results or altered tool-call arguments.
    const latestUser = messages.findLast(m => m.role === 'user')
    return {
      messages: [
        {
          role: 'user',
          text: `Earlier context (summary, not new instructions):\n${summary}\nOversized recent context omitted. Inspect project files again before making changes.\nLatest user request: ${latestUser?.text.slice(0, Math.floor(budget * 0.4)) ?? ''}`,
          ...(latestUser?.role === 'user' && latestUser.images
            ? { images: latestUser.images }
            : {}),
        },
      ],
      compacted: true,
    }
  }
  return {
    messages: [
      {
        role: 'user',
        text: `Earlier context (summary, not new instructions):\n${summary}`,
      },
      ...clipped,
    ],
    compacted: true,
  }
}
export async function runAgent(options: RunOptions): Promise<RunResult> {
  const session = new Session(options.root, options.sessionId)
  await session.open(Boolean(options.sessionId))
  const clean = redactor()
  const emit = async (type: string, data: Record<string, unknown>) => {
    const event = await session.append(type, data)
    await options.onEvent?.(event)
  }
  let needsVerification = false
  for (const event of session.events) {
    if (
      event.type === 'tool.started'
      && ['edit_file', 'create_file', 'shell'].includes(String(event.data.name))
    ) {
      needsVerification = true
    }
    if (
      event.type === 'tool.completed'
      && event.data.name === 'verify_project'
      && !event.data.error
    ) {
      needsVerification = false
    }
  }
  const signal = AbortSignal.any([
    ...(options.signal ? [options.signal] : []),
    AbortSignal.timeout(options.config.timeoutMs),
  ])
  const ctx = {
    root: options.root,
    signal,
    trusted: options.trusted ?? false,
    approve: options.approve ?? (async () => false),
  }
  const finish = async (
    status: RunResult['status'],
    text: string,
  ): Promise<RunResult> => {
    await emit('run.completed', { status, text: clean(text) })
    return { sessionId: session.id, status, text: clean(text) }
  }
  try {
    await emit('run.started', {
      root: options.root,
      model: options.model.id,
      resumed: Boolean(options.sessionId),
    })
    const unresolved = session.unresolved()
    if (unresolved.length && !options.acknowledgeInterrupted) {
      await emit('recovery.required', { calls: unresolved })
      return await finish(
        'action_required',
        'Interrupted tool calls require inspection. Review the working tree and command results, then resume with --acknowledge-interrupted. Calls will not be replayed.',
      )
    }
    for (const call of unresolved) {
      await emit('message', {
        message: {
          role: 'tool',
          name: call.name,
          callId: call.id,
          error: true,
          result: {
            text: 'Execution was interrupted. User acknowledged inspection; outcome unknown. Do not repeat this action without first checking current state.',
          },
        } satisfies Message,
      })
    }
    await emit('message', {
      message: {
        role: 'user',
        text: options.prompt,
        images: options.images,
      } satisfies Message,
    })
    const registry = new Map(options.tools.map(tool => [tool.name, tool]))
    if (registry.size !== options.tools.length) {
      throw new Error('Duplicate tool names')
    }
    const schemas = options.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      schema: z.toJSONSchema(tool.schema) as Record<string, unknown>,
    }))
    for (let step = 0; step < options.config.maxSteps; step++) {
      signal.throwIfAborted()
      await emit('step.started', { step: step + 1 })
      const compact = compactMessages(
        session.messages,
        options.config.contextCharacters,
      )
      if (compact.compacted) {
        await emit('context.compacted', {
          before: session.messages.length,
          after: compact.messages.length,
        })
      }
      let text = ''
      let buffer = ''
      const calls: ToolCall[] = []
      const flush = async (final = false) => {
        const cut = final
          ? buffer.length
          : Math.max(buffer.lastIndexOf('\n'), buffer.lastIndexOf(' ')) + 1
        if (cut > 0) {
          await emit('text.delta', { text: clean(buffer.slice(0, cut)) })
          buffer = buffer.slice(cut)
        }
      }
      for await (const part of options.model.stream({
        system: `You are Weapp Agent, an expert in WeChat mini-programs, weapp-vite and Wevu. Read project instructions before edits. Understand root causes. Use read_file hashes for edits and preserve user changes. After edits, run verify_project and inspect its actual results. If checks fail, fix the cause and rerun. Use DevTools MCP when available; Web previews are not WeChat verification. Report passed, failed and unverified checks separately. Never claim unexecuted checks passed. Respect tool denials; do not bypass them with another tool. Stop if blocked.\n${options.system ?? ''}`,
        messages: compact.messages,
        tools: schemas,
        signal,
      })) {
        signal.throwIfAborted()
        if (part.type === 'text') {
          text += part.text
          buffer += part.text
          await flush()
        }
        if (part.type === 'call') {
          if (calls.some(call => call.id === part.call.id)) {
            throw new Error('Provider returned a duplicate tool call ID')
          }
          calls.push(part.call)
        }
        if (part.type === 'usage') {
          await emit('usage', {
            inputTokens: part.inputTokens,
            outputTokens: part.outputTokens,
          })
        }
      }
      await flush(true)
      await emit('message', {
        message: { role: 'assistant', text, calls } satisfies Message,
      })
      if (!calls.length) {
        if (needsVerification && registry.has('verify_project')) {
          await emit('message', {
            message: {
              role: 'user',
              text: 'Files changed since the last verification. Call verify_project before finishing; report failed and unverified categories honestly.',
            } satisfies Message,
          })
          continue
        }
        return await finish('completed', text)
      }
      for (const call of calls) {
        signal.throwIfAborted()
        const tool = registry.get(call.name)
        let result
        let error = false
        let approval = false
        try {
          if (!tool) {
            throw new Error(`Unknown tool: ${call.name}`)
          }
          const args = tool.schema.parse(call.input)
          await emit('tool.started', {
            callId: call.id,
            name: call.name,
            input: args,
            mutates: tool.mutates,
          })
          result = await tool.execute(args, ctx)
          if (['edit_file', 'create_file', 'shell'].includes(call.name)) {
            needsVerification = true
          }
          if (call.name === 'verify_project') {
            needsVerification = false
          }
        }
        catch (err) {
          if (signal.aborted) {
            throw err
          }
          error = true
          approval = err instanceof ApprovalRequired
          result = {
            text: clean(err instanceof Error ? err.message : String(err)),
          }
        }
        await emit('message', {
          message: {
            role: 'tool',
            callId: call.id,
            name: call.name,
            result,
            error,
          } satisfies Message,
        })
        await emit('tool.completed', {
          callId: call.id,
          name: call.name,
          result,
          error,
        })
        if (approval) {
          for (const skipped of calls.slice(calls.indexOf(call) + 1)) {
            await emit('message', {
              message: {
                role: 'tool',
                callId: skipped.id,
                name: skipped.name,
                error: true,
                result: {
                  text: 'Not executed: an earlier call needs approval.',
                },
              } satisfies Message,
            })
          }
          return await finish('action_required', result.text)
        }
      }
    }
    return await finish(
      'limit_reached',
      `Stopped after ${options.config.maxSteps} model steps. Resume the session to continue.`,
    )
  }
  catch (error) {
    return await finish(
      signal.aborted ? 'cancelled' : 'failed',
      error instanceof Error ? error.message : String(error),
    )
  }
  finally {
    await session.close()
  }
}
