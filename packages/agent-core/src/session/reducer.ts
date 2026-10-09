import type { Message, RunStatus, SessionEvent } from '../types.js'
import type { PendingToolCall, SessionSummary } from './types.js'
import { SessionJournalError } from './reader.js'

export interface SessionState {
  messages: Message[]
  pendingCalls: PendingToolCall[]
  prompt: string
  updatedAt: string | null
  status: SessionSummary['status']
  reason?: SessionSummary['reason']
  steps: number
  usage: SessionSummary['usage']
  diagnostics: string[]
}

/** 顺序消费记录，完成结果只匹配在它之前声明的调用。 */
export function reduceSession(events: SessionEvent[]): SessionState {
  const deferredInputs: Message[] = []
  const state: SessionState = {
    messages: [],
    pendingCalls: [],
    prompt: '',
    updatedAt: null,
    status: 'empty',
    steps: 0,
    usage: { inputTokens: 0, outputTokens: 0 },
    diagnostics: [],
  }
  for (const event of events) {
    state.updatedAt = event.timestamp
    if (event.type === 'run.started') {
      state.status = 'unfinished'
      state.reason = undefined
      state.steps = 0
      state.usage = { inputTokens: 0, outputTokens: 0 }
    }
    if (event.type === 'run.completed') {
      state.status = event.data.status as RunStatus
      state.reason = event.data.reason as SessionSummary['reason']
    }
    if (event.type === 'step.started') {
      state.steps = Math.max(state.steps, Number(event.data.step))
    }
    if (event.type === 'usage') {
      state.usage.inputTokens += Number(event.data.inputTokens)
      state.usage.outputTokens += Number(event.data.outputTokens)
    }
    if (event.type === 'message') {
      const message = event.data.message as Message
      // 原始日志及时保留输入；模型投影须先完成当前工具组，再接收追加要求。
      if (message.role === 'user' && state.pendingCalls.length) {
        deferredInputs.push(message)
      }
      else {
        state.messages.push(message)
      }
      if (state.status === 'empty') {
        state.status = 'unfinished'
      }
      if (message.role === 'user' && message.origin !== 'engine') {
        state.prompt = message.text
      }
      if (message.role === 'assistant') {
        for (const call of message.calls ?? []) {
          if (state.pendingCalls.some(pending => pending.id === call.id)) {
            throw new SessionJournalError('Ambiguous session journal: multiple unresolved tool calls share an ID; refusing to replay it.', events)
          }
          state.pendingCalls.push({ ...call, state: 'not_executed' })
        }
      }
      if (message.role === 'tool') {
        const index = state.pendingCalls.findIndex(call => call.id === message.callId)
        if (index >= 0) {
          if (state.pendingCalls[index]!.name !== message.name) {
            throw new SessionJournalError('Invalid session journal: tool result name does not match its pending call; refusing to replay it.', events)
          }
          state.pendingCalls.splice(index, 1)
          if (!state.pendingCalls.length) {
            state.messages.push(...deferredInputs.splice(0))
          }
        }
        else {
          throw new SessionJournalError(`Invalid session journal: tool result in record ${event.sequence} has no preceding pending call; refusing to replay it.`, events)
        }
      }
    }
    if (event.type === 'tool.started') {
      const pending = state.pendingCalls.find(call => call.id === event.data.callId)
      if (pending) {
        if (event.data.name !== undefined && event.data.name !== pending.name) {
          throw new SessionJournalError('Invalid session journal: tool start name does not match its pending call; refusing to replay it.', events)
        }
        pending.state = 'outcome_unknown'
      }
      else {
        throw new SessionJournalError(`Invalid session journal: tool start in record ${event.sequence} has no preceding pending call; refusing to replay it.`, events)
      }
    }
  }
  // 恢复确认前也允许读取已接收的全部输入；执行门禁负责阻止未完成工具组进入模型。
  state.messages.push(...deferredInputs)
  return state
}
