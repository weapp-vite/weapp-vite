import type { SemanticScenario, SemanticTools, SemanticWorkerRequest } from './types'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { executeSemanticModule } from './execute'

/** 仅用于子进程回归测试，不属于真实页面场景 registry。 */
function fixture(id: string, tools: SemanticTools): SemanticScenario {
  const events: string[] = []
  let registered: unknown
  let finishPending: (() => void) | undefined
  return {
    id,
    imports: {
      fixture: {
        value: 2,
        install: () => events.push('install'),
        register: (options: unknown) => {
          events.push('register')
          registered = options
        },
      },
    },
    globals: {
      trackPending: () => void tools.track('unfinished service', new Promise<void>((resolve) => { finishPending = resolve })),
      rejectTracked: () => void tools.track('rejected service', Promise.reject(new Error('tracked rejection'))),
      startDetached: () => void Promise.resolve().then(() => { throw new Error('detached rejection') }),
    },
    coverage: {
      inlineIds: ['run'],
      computedKeys: id.endsWith('computed') && !id.startsWith('unknown') ? ['derive'] : [],
      lifecycleNames: id.endsWith('lifecycle') && !id.startsWith('unknown') ? ['onLoad'] : [],
      requiredAssertions: ['registration', 'invocation'],
    },
    async observe(namespace) {
      assert.deepEqual(events, ['install', 'register'])
      assert.equal(namespace.default, registered)
      assert.equal(typeof namespace.run, 'function')
      const value = await tools.step('run', () => (namespace.run as () => unknown)())
      assert.equal(value, 3)
      tools.record('observed', { value, events })
      return {
        assertions: [{ id: 'registration', passed: true }, { id: 'invocation', passed: true }],
        inlineInvocations: id === 'missing-inline' ? [] : [{ id: id === 'unknown-inline' ? 'unlisted' : 'run', value, executions: id === 'zero-inline' ? 0 : 1 }],
        computedInvocations: id === 'unknown-computed' ? [{ id: 'unlisted', executions: 1 }] : id === 'zero-computed' ? [{ id: 'derive', executions: 0 }] : [],
        lifecycleInvocations: id === 'unknown-lifecycle' ? [{ id: 'unlisted', executions: 1 }] : id === 'zero-lifecycle' ? [{ id: 'onLoad', executions: 0 }] : [],
        events,
        value,
      }
    },
    dispose() {
      if (id === 'cleanup-settle') {
        finishPending?.()
      }
      if (id === 'cleanup-pending') {
        void tools.track('unfinished cleanup', new Promise(() => {}))
      }
      if (id === 'throws-cleanup') {
        throw new Error('cleanup failed')
      }
      tools.record('fixture:disposed')
    },
  }
}

const request = JSON.parse(readFileSync(0, 'utf8')) as SemanticWorkerRequest
const result = await executeSemanticModule(request, fixture)
process.stdout.write(JSON.stringify(result))
process.exitCode = result.passed ? 0 : 1
