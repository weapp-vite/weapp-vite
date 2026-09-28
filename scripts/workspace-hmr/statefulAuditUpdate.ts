import type { StatefulHmrAuditClient, StatefulHmrAuditControl } from './statefulAuditClient'
import { setTimeout as sleep } from 'node:timers/promises'

export interface StatefulHmrAuditEvent {
  type: string
  targetVersion?: number
}

export async function waitForStatefulHmrAuditUpdate(options: {
  client: StatefulHmrAuditClient
  readControl: () => Promise<StatefulHmrAuditControl>
  isCurrentUpdate: () => Promise<boolean>
  timeoutMs: number
  onEvent?: (event: StatefulHmrAuditEvent) => void
}) {
  const deadline = Date.now() + options.timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const control = await options.readControl()
      await options.client.ensureRegistered(control, Math.max(1, Math.min(30_000, deadline - Date.now())))
      while (Date.now() < deadline) {
        const response = await options.client.poll(Math.max(1, Math.min(30_000, deadline - Date.now())))
        options.onEvent?.({ type: response.type ?? 'unknown', targetVersion: response.targetVersion })
        if (response.type === 'batch-published' && await options.isCurrentUpdate()) {
          return
        }
        if (response.type === 'rebuilding') {
          break
        }
      }
    }
    catch (error) {
      lastError = error
      options.onEvent?.({ type: 'request-error' })
    }
    await sleep(Math.min(100, Math.max(0, deadline - Date.now())))
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
