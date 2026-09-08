import type { TestContext } from 'vitest'
import type { DomAcceptance, DomCheckpoint, DomPage, DomSession } from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { flushRuntimeConsoleSessions } from '../runtimeConsoleSessions'
import { resolveRuntimeProviderName } from '../runtimeProvider'
import { captureDomCheckpoint, validateDomPlan } from './checkpoint'
import { runDomCheckpointAction } from './errorScope'

declare module 'vitest' {
  interface TaskMeta {
    domAcceptance?: DomAcceptance
  }
}

export function createDomAcceptance(context: TestContext, fixture: string, checkpoints: DomCheckpoint[]) {
  const plan: DomAcceptance = {
    fixture,
    provider: resolveRuntimeProviderName(),
    checkpoints: structuredClone(checkpoints),
    evidence: [],
  }
  validateDomPlan(plan)
  if (context.task.meta.domAcceptance) {
    throw new Error('Each case must register its DOM acceptance plan exactly once')
  }
  context.task.meta.domAcceptance = plan
  let closed = false
  context.onTestFinished(() => {
    closed = true
  })
  return {
    async act<T>(id: string, action: () => Promise<T>) {
      if (closed || context.task.meta.domAcceptance !== plan) {
        throw new Error('Cannot reuse DOM actions across cases or retries')
      }
      return await runDomCheckpointAction(plan, context.task.id, id, action)
    },
    async check(id: string, session: DomSession, page: DomPage, timeout?: number) {
      if (closed || context.task.meta.domAcceptance !== plan) {
        throw new Error('Cannot reuse DOM evidence across cases or retries')
      }
      const checkpoint = plan.checkpoints[plan.evidence.length]
      if (checkpoint?.id !== id) {
        throw new Error(`Expected DOM checkpoint ${checkpoint?.id ?? '<complete>'}, received ${id}`)
      }
      if (plan.provider === 'devtools' && session.toolInfo) {
        const info = await session.toolInfo()
        const runtime = { ideVersion: info.version ?? null, baseLibraryVersion: info.SDKVersion ?? null }
        if (plan.runtime && (plan.runtime.ideVersion !== runtime.ideVersion || plan.runtime.baseLibraryVersion !== runtime.baseLibraryVersion)) {
          throw new Error('Observed runtime versions changed during a DOM acceptance case')
        }
        plan.runtime = runtime
      }
      await flushRuntimeConsoleSessions()
      let evidence
      try {
        evidence = await captureDomCheckpoint(session, page, checkpoint, plan.provider, timeout)
      }
      catch (error) {
        const failure: NonNullable<DomAcceptance['failures']>[number] = { checkpoint: id }
        if (plan.provider === 'devtools' && session.screenshot) {
          try {
            const root = path.resolve(import.meta.dirname, '../../..')
            const directory = process.env.WEAPP_VITE_E2E_ACCEPTANCE_REPORT_DIR || path.join(root, 'docs/reports/dom-acceptance')
            const screenshot = path.join(directory, `${randomUUID()}.png`)
            await fs.mkdir(directory, { recursive: true })
            await session.screenshot({ path: screenshot })
            failure.screenshot = path.relative(root, screenshot).replaceAll('\\', '/')
          }
          catch (screenshotError) {
            failure.screenshotError = screenshotError instanceof Error ? screenshotError.message : String(screenshotError)
          }
        }
        plan.failures ??= []
        plan.failures.push(failure)
        throw error
      }
      finally {
        await flushRuntimeConsoleSessions()
      }
      if (closed || context.task.meta.domAcceptance !== plan) {
        throw new Error('DOM checkpoint completed after its case ended')
      }
      plan.evidence.push(evidence)
      return evidence
    },
  }
}
