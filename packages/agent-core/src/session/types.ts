import type { RunStatus, SessionEvent, ToolCall } from '../types.js'

export interface PendingToolCall extends ToolCall {
  state: 'not_executed' | 'outcome_unknown'
}

export interface SessionSummary {
  sessionId: string
  updatedAt: string | null
  prompt: string
  status: RunStatus | 'unfinished' | 'empty' | 'invalid'
  reason?: 'max_steps' | 'context_budget'
  steps: number
  usage: { inputTokens: number, outputTokens: number }
  pendingCalls: PendingToolCall[]
  diagnostics: string[]
}

export interface SessionJournal {
  events: SessionEvent[]
  diagnostics: string[]
  completeBytes: number
  incompleteTail: boolean
}
