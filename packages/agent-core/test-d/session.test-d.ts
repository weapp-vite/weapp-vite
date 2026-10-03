import type { Message, PendingToolCall, RunResult, SessionSummary, ToolCall } from '@weapp-agent/core'
import { Session } from '@weapp-agent/core'
import { expectAssignable, expectType } from 'tsd'

expectAssignable<Message>({ role: 'user', text: 'legacy input' })
expectAssignable<Message>({ role: 'user', text: 'task', origin: 'user' })
expectAssignable<Message>({ role: 'user', text: 'verification reminder', origin: 'engine' })
expectAssignable<RunResult>({ sessionId: 'session', status: 'limit_reached', text: 'budget', reason: 'context_budget' })
expectAssignable<RunResult>({ sessionId: 'session', status: 'limit_reached', text: 'steps', reason: 'max_steps' })
expectAssignable<RunResult>({ sessionId: 'session', status: 'completed', text: 'legacy result' })

expectType<Promise<string[]>>(Session.list('.'))
expectType<Promise<SessionSummary>>(Session.inspect('.', 'session'))
expectType<Promise<SessionSummary[]>>(Session.listSummaries('.'))

declare const session: Session
expectType<ToolCall[]>(session.unresolved())
expectType<PendingToolCall[]>(session.recovery())

declare const summary: SessionSummary
expectType<string | null>(summary.updatedAt)
expectType<PendingToolCall[]>(summary.pendingCalls)
expectType<number>(summary.usage.inputTokens)
expectType<number>(summary.usage.outputTokens)
