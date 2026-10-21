import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import type { StatefulHmrAuditClient, StatefulHmrAuditControl } from './statefulAuditClient'
import { setTimeout as sleep } from 'node:timers/promises'
import { assertHmrAuditBudget } from './auditDeadline'

export interface StatefulHmrAuditEvent {
  type: string
  targetVersion?: number
}

export async function waitForStatefulHmrAuditUpdate(options: {
  client: StatefulHmrAuditClient
  readControl: () => Promise<StatefulHmrAuditControl>
  isCurrentUpdate: () => Promise<boolean>
  timeoutMs: number
  deadline?: number
  signal?: AbortSignal
  onEvent?: (event: StatefulHmrAuditEvent) => void
  isClassicFallback?: (budget: WorkspaceHmrAuditBudget) => Promise<boolean>
}) {
  const deadline = options.deadline ?? Date.now() + options.timeoutMs
  const budget = { deadline, signal: options.signal }
  const assertCurrent = () => assertHmrAuditBudget(budget, 'Timed out waiting for a stateful HMR patch batch matching the current source mutation.')
  const isClassic = async () => {
    const classic = await options.isClassicFallback?.(budget)
    assertCurrent()
    return classic
  }
  let lastError: unknown
  while (Date.now() < deadline) {
    assertCurrent()
    if (await isClassic()) {
      return
    }
    try {
      const control = await options.readControl()
      assertCurrent()
      await options.client.ensureRegistered(control, Math.max(1, Math.min(30_000, deadline - Date.now())), options.signal)
      while (Date.now() < deadline) {
        if (await isClassic()) {
          return
        }
        const response = await options.client.poll(Math.max(1, Math.min(30_000, deadline - Date.now())), options.signal)
        assertCurrent()
        options.onEvent?.({ type: response.type ?? 'unknown', targetVersion: response.targetVersion })
        if (response.type === 'batch-published' && await options.isCurrentUpdate()) {
          assertCurrent()
          return
        }
        if (response.type === 'rebuilding') {
          break
        }
      }
    }
    catch (error) {
      options.signal?.throwIfAborted()
      lastError = error
      options.onEvent?.({ type: 'request-error' })
    }
    await sleep(Math.min(100, Math.max(0, deadline - Date.now())), undefined, { signal: options.signal })
  }
  throw new Error('Timed out waiting for a stateful HMR patch batch matching the current source mutation.', { cause: lastError })
}

/** 新增 Vue 节点会生成绑定脚本；产物计时结束后消费伴随补丁，旧协议保持原路径。 */
export async function acknowledgeStatefulTemplateArtifact(options: Parameters<typeof waitForStatefulHmrAuditUpdate>[0]) {
  await options.client.ensureRegistered(await options.readControl(), options.timeoutMs)
  if (!options.client.supportsExplicitAcknowledgement) {
    return
  }
  await waitForStatefulHmrAuditUpdate(options)
  await options.client.acknowledgePublished(options.timeoutMs)
}
