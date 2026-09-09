import type { StatefulHmrAuditClient, StatefulHmrAuditControl } from './statefulAuditClient'
import { setTimeout as sleep } from 'node:timers/promises'

export async function waitForStatefulHmrAuditUpdate(options: {
  client: StatefulHmrAuditClient
  readControl: () => Promise<StatefulHmrAuditControl>
  isCurrentUpdate: () => Promise<boolean>
  timeoutMs: number
}) {
  const deadline = Date.now() + options.timeoutMs
  let lastError: unknown
  while (Date.now() < deadline) {
    try {
      const control = await options.readControl()
      await options.client.ensureRegistered(control, Math.max(1, Math.min(30_000, deadline - Date.now())))
      while (Date.now() < deadline) {
        const response = await options.client.poll(Math.max(1, Math.min(30_000, deadline - Date.now())))
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
    }
    await sleep(Math.min(100, Math.max(0, deadline - Date.now())))
  }
  throw new Error('Timed out waiting for a stateful HMR patch batch matching the current source mutation.', { cause: lastError })
}
