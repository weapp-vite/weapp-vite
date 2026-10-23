import type { WorkspaceHmrAuditBudget } from './auditDeadline'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, WEAPP_VITE_STATEFUL_HMR_DIRECTORY } from '@weapp-core/constants'
import { assertNoStatefulInstallations } from '../../packages/weapp-vite/scripts/consumerHmr/installedRuntime.mjs'
import { createEmittedScriptReader } from '../benchmarkTemplatesHmr/emittedOutput'
import { assertHmrAuditBudget } from './auditDeadline'
import { inspectClassicEmittedScript } from './classicRuntimeInspection'

function inspectClassicSource(ast: Parameters<typeof inspectClassicEmittedScript>[0], source: string, filename: string) {
  inspectClassicEmittedScript(ast)
  assertNoStatefulInstallations(filename, source)
}

export interface ClassicFallbackDeliveryEvidence {
  delivery: 'classic'
  from: 'stateful-experimental'
  actualMode: 'classic'
  reason: string
  output: string
  containsMarker: boolean
}

/** 仅以同一开发进程的转换记录和已释放产物确认 classic，缺文件或 410 本身不是证据。 */
export class WorkspaceHmrClassicFallback {
  private reason?: string
  private settled = false
  private readonly readApp: () => Promise<string>

  constructor(private readonly distRoot: string, private readonly getOutput: () => string) {
    this.readApp = createEmittedScriptReader(path.join(distRoot, 'app.js'), distRoot, { inspect: inspectClassicSource })
  }

  get requested() {
    this.readTransition()
    return this.reason !== undefined
  }

  get actualMode() {
    return this.settled ? 'classic' as const : undefined
  }

  get fallbackReason() {
    return this.reason
  }

  private readTransition() {
    let ready = false
    let transitions = 0
    let requestedMode: 'auto' | 'stateful-experimental' | undefined
    for (const line of this.getOutput().split(/\r?\n/)) {
      const fallback = line.match(/\[weapp-vite\] HMR fallback (\{.*\})/)
      if (fallback) {
        if (++transitions > 1) {
          throw new Error('Classic fallback transitioned more than once within one development session.')
        }
        const record = JSON.parse(fallback[1]!) as Record<string, unknown>
        if (record.from !== 'stateful-experimental' || record.to !== 'classic'
          || typeof record.reason !== 'string' || !record.reason || typeof record.message !== 'string'
          || (record.requested !== 'auto' && record.requested !== 'stateful-experimental')
          || record.actual !== 'classic' || record.phase !== 'switching') {
          throw new Error('Invalid classic fallback transition evidence.')
        }
        if (this.reason && this.reason !== record.reason) {
          throw new Error('Classic fallback reason changed within one development session.')
        }
        this.reason = record.reason
        requestedMode = record.requested
        ready = false
      }
      const completion = line.match(/\[weapp-vite\] HMR classic ready (\{.*\})/)
      if (completion) {
        const record = JSON.parse(completion[1]!) as Record<string, unknown>
        if (!this.reason || record.reason !== this.reason || record.requested !== requestedMode
          || record.actual !== 'classic' || record.phase !== 'classic') {
          throw new Error('Classic readiness does not match its fallback transition.')
        }
        ready = true
      }
    }
    return ready
  }

  private async assertClassicArtifacts(signal?: AbortSignal) {
    for (const file of ['control.js', 'update.js', 'preload.js']) {
      try {
        await access(path.join(this.distRoot, '__weapp_vite_hmr', file))
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          continue
        }
        throw error
      }
      throw new Error(`Classic fallback retained stateful artifact: ${file}`)
    }
    const appFile = path.join(this.distRoot, 'app.js')
    const entry = await readFile(appFile, { encoding: 'utf8', signal })
    this.assertNoStatefulRuntime(entry)
    const app = await this.readApp()
    const config: unknown = JSON.parse(await readFile(path.join(this.distRoot, 'app.json'), { encoding: 'utf8', signal }))
    signal?.throwIfAborted()
    if (!app.trim() || !config || typeof config !== 'object') {
      throw new Error('Classic fallback did not publish a complete app without stateful control.')
    }
    this.assertNoStatefulRuntime(app)
  }

  private assertNoStatefulRuntime(source: string) {
    if (/^\/\/ weapp-vite-stateful-build:/m.test(source)) {
      throw new Error('Classic fallback output retained stateful control or a full-build stamp.')
    }
  }

  async settle(budget: WorkspaceHmrAuditBudget) {
    let lastError: unknown
    while (Date.now() < budget.deadline) {
      budget.signal?.throwIfAborted()
      if (this.readTransition()) {
        try {
          await this.assertClassicArtifacts(budget.signal)
          assertHmrAuditBudget(budget, 'Classic readiness arrived after the mutation deadline.')
          this.settled = true
          return true
        }
        catch (error) {
          budget.signal?.throwIfAborted()
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error
          }
          lastError = error
        }
      }
      await sleep(Math.min(25, Math.max(0, budget.deadline - Date.now())), undefined, { signal: budget.signal })
    }
    throw new Error('Classic fallback has no matching ready transition and released stateful artifacts before the mutation deadline.', { cause: lastError })
  }

  async waitForDelivery(options: {
    readOutput: () => Promise<string>
    output: string
    marker: string
    contains: boolean
  } & WorkspaceHmrAuditBudget): Promise<ClassicFallbackDeliveryEvidence> {
    await this.settle(options)
    const readOutput = options.output.endsWith('.js')
      ? createEmittedScriptReader(path.resolve(this.distRoot, options.output), this.distRoot, { inspect: inspectClassicSource })
      : options.readOutput
    let lastError: unknown
    while (Date.now() < options.deadline) {
      options.signal?.throwIfAborted()
      try {
        const output = await readOutput()
        options.signal?.throwIfAborted()
        await this.assertClassicArtifacts(options.signal)
        this.assertNoStatefulRuntime(output)
        if (!options.output.endsWith('.js') && [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, WEAPP_VITE_STATEFUL_HMR_DIRECTORY].some(key => output.includes(key))) {
          throw new Error('Classic fallback output retained a stateful control path.')
        }
        if (output.trim() && output.includes(options.marker) === options.contains && Date.now() < options.deadline) {
          return { delivery: 'classic', from: 'stateful-experimental', actualMode: 'classic', reason: this.reason!, output: options.output, containsMarker: options.contains }
        }
      }
      catch (error) {
        options.signal?.throwIfAborted()
        lastError = error
      }
      await sleep(Math.min(25, Math.max(0, options.deadline - Date.now())), undefined, { signal: options.signal })
    }
    throw new Error('Classic output does not match the current source mutation.', { cause: lastError })
  }
}
