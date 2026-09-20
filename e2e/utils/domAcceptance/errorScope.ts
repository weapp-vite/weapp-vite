import type { DomAcceptance } from './types'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { appendIdeReportEvent } from '../ideWarningReport'
import { flushRuntimeConsoleSessions } from '../runtimeConsoleSessions'

export async function runDomCheckpointAction<T>(plan: DomAcceptance, caseId: string, checkpoint: string, action: () => Promise<T>): Promise<T> {
  if (plan.checkpoints[plan.evidence.length]?.id !== checkpoint) {
    throw new Error('DOM action must belong to the next unverified checkpoint')
  }
  if (!process.env.WEAPP_VITE_E2E_REPORT_EVENT_LOG_FILE) {
    throw new Error('DOM action requires a configured diagnostic event journal')
  }
  if (plan.errorScopes?.some(scope => scope.checkpoint === checkpoint)) {
    throw new Error(`DOM checkpoint action cannot be replayed: ${checkpoint}`)
  }
  await flushRuntimeConsoleSessions()
  const id = randomUUID()
  plan.errorScopes ??= []
  plan.errorScopes.push({ checkpoint, id })
  const boundary = (phase: 'start' | 'end') => appendIdeReportEvent({
    source: 'runtime',
    kind: 'message',
    project: plan.fixture,
    level: 'debug',
    channel: 'dom-acceptance-boundary',
    acceptanceScope: { id, caseId, checkpointId: checkpoint, boundary: phase },
  })
  boundary('start')
  let actionFailed = false
  let actionError: unknown
  let result: T | undefined
  try {
    result = await action()
  }
  catch (error) {
    actionFailed = true
    actionError = error
  }
  let flushFailed = false
  let flushError: unknown
  try {
    await flushRuntimeConsoleSessions()
  }
  catch (error) {
    flushFailed = true
    flushError = error
  }
  finally {
    boundary('end')
  }
  if (actionFailed && flushFailed) {
    throw new AggregateError([actionError, flushError], 'DOM action and console inspection both failed')
  }
  if (flushFailed) {
    throw flushError
  }
  if (actionFailed) {
    throw actionError
  }
  return result as T
}
