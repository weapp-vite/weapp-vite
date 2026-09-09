import type { StatefulHmrAuditClient, StatefulHmrAuditControl } from './statefulAuditClient'
import type { StatefulHmrAuditEvent } from './statefulAuditUpdate'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { createEmittedScriptReader } from '../benchmarkTemplatesHmr/emittedOutput'
import { parseStatefulHmrControlSource } from './scenarios'

export interface DynamicReactDeliveryEvidence {
  delivery: 'patch' | 'full-reload'
  beforeBuildId: string
  buildId: string
  entryBuildId: string
  output: string
  containsMarker: boolean
  targetVersion?: number
}

export interface DynamicReactMutation {
  waitForDelivery: (marker: string, contains: boolean, onEvent?: (event: StatefulHmrAuditEvent) => void) => Promise<DynamicReactDeliveryEvidence>
}

interface DynamicReactDeliveryOptions {
  client: StatefulHmrAuditClient
  distRoot: string
  entryFile: string
  timeoutMs: number
  intervalMs?: number
}

function readBuildStamp(source: string) {
  const buildId = source.match(/^\/\/ weapp-vite-stateful-build:([^\r\n]+)\r?\n/)?.[1]
  if (!buildId) {
    throw new Error('Missing stateful full-build stamp on emitted entry.')
  }
  return buildId
}

/** 仅供显式 dynamic React 场景使用；修改前绑定已提交构建，其他场景仍要求 patch。 */
export async function prepareDynamicReactMutation(options: DynamicReactDeliveryOptions): Promise<DynamicReactMutation> {
  const controlFile = path.join(options.distRoot, '__weapp_vite_hmr/control.js')
  const patchFile = path.join(options.distRoot, '__weapp_vite_hmr/update.js')
  const label = (file: string) => path.relative(options.distRoot, file).replaceAll('\\', '/')
  const readControl = async () => parseStatefulHmrControlSource(await readFile(controlFile, 'utf8'))
  const readReachable = createEmittedScriptReader(options.entryFile, options.distRoot)
  const readCommittedBuild = async (control: StatefulHmrAuditControl) => {
    const [app, entry, reachable] = await Promise.all([
      readFile(path.join(options.distRoot, 'app.js'), 'utf8'),
      readFile(options.entryFile, 'utf8'),
      readReachable(),
    ])
    const current = await readControl()
    if (current.buildId !== control.buildId || readBuildStamp(app) !== control.buildId || readBuildStamp(entry) !== control.buildId) {
      throw new Error('Stateful control and emitted entries do not belong to one committed build.')
    }
    return reachable
  }
  const before = await readControl()
  await readCommittedBuild(before)
  await options.client.ensureRegistered(before, options.timeoutMs)
  const beforeVersion = options.client.acknowledgedVersion

  let consumed = false
  return {
    async waitForDelivery(marker, contains, onEvent) {
      if (consumed) {
        throw new Error('Each dynamic React mutation requires a fresh pre-mutation build identity.')
      }
      consumed = true
      const deadline = Date.now() + options.timeoutMs
      let lastError: unknown
      while (Date.now() < deadline) {
        try {
          const control = await readControl()
          await options.client.ensureRegistered(control, Math.max(1, Math.min(1_000, deadline - Date.now())))
          if (control.buildId !== before.buildId) {
            const reachable = await readCommittedBuild(control)
            if (reachable.includes(marker) === contains && Date.now() < deadline) {
              onEvent?.({ type: 'full-reload' })
              return {
                delivery: 'full-reload',
                beforeBuildId: before.buildId,
                buildId: control.buildId,
                entryBuildId: control.buildId,
                output: label(options.entryFile),
                containsMarker: contains,
              }
            }
          }
          else {
            // 短轮询允许重读 control；服务重启后旧端口不能挡住完整重载验收。
            const response = await options.client.poll(Math.max(1, Math.min(1_000, deadline - Date.now())))
            onEvent?.({ type: response.type ?? 'unknown', targetVersion: response.targetVersion })
            if (response.type === 'batch-published' && response.targetVersion !== undefined && response.targetVersion > beforeVersion) {
              const patch = await readFile(patchFile, 'utf8')
              await readCommittedBuild(control)
              if (patch.includes(marker) === contains && Date.now() < deadline) {
                return {
                  delivery: 'patch',
                  beforeBuildId: before.buildId,
                  buildId: control.buildId,
                  entryBuildId: control.buildId,
                  output: label(patchFile),
                  containsMarker: contains,
                  targetVersion: response.targetVersion,
                }
              }
            }
          }
        }
        catch (error) {
          lastError = error
          onEvent?.({ type: 'request-error' })
        }
        await sleep(Math.min(options.intervalMs ?? 25, Math.max(0, deadline - Date.now())))
      }
      const reason = lastError instanceof Error ? lastError.message : ''
      throw new Error(`Timed out waiting for dynamic React delivery matching the current source mutation.${reason ? ` ${reason}` : ''}`, { cause: lastError })
    },
  }
}
