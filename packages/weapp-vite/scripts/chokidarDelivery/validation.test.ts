import assert from 'node:assert/strict'
import { it } from 'vitest'
import { completePublicValidation, preparePublicWorkerScope, runCandidateValidation } from './validation.mjs'

function createHarness() {
  const events: string[] = []
  const snapshots: unknown[] = []
  const controller = new AbortController()
  const report: { status: string, results: { id: string, status: string, cleanupConfirmed?: boolean }[], negativeControl: { status: string }, acceptance?: Record<string, unknown> } = { status: 'running', results: [], negativeControl: { status: 'not-run' } }
  const scenarios = [{ id: 'first' }, { id: 'second' }]
  const options = {
    report,
    scenarios,
    nativePlatform: 'darwin',
    signal: controller.signal,
    nonApplicableReason: () => undefined,
    async verifyTypes() {
      events.push('types')
      return { status: 'passed' }
    },
    async runScenario(scenario: { id: string }) {
      events.push(scenario.id)
      return { id: scenario.id, status: 'passed', cleanupConfirmed: true }
    },
    async persist() {
      events.push('persist')
      snapshots.push(structuredClone(report))
    },
  }
  return { report, controller, events, snapshots, options }
}

it('类型失败保留严格编译证据，独立 runtime 按序完成且 overall 失败', async () => {
  const harness = createHarness()
  const error = Object.assign(new Error('strict declaration failed'), { exitCode: 2, stdout: 'TS2451 duplicate global', stderr: 'compiler diagnostic' })
  harness.options.verifyTypes = async () => {
    harness.events.push('types')
    throw error
  }
  await runCandidateValidation(harness.options)
  completePublicValidation(harness.report, 'darwin', 2)
  assert.deepEqual(harness.events, ['types', 'persist', 'first', 'persist', 'second', 'persist'])
  assert.equal(harness.snapshots.length, 3)
  assert.deepEqual(harness.snapshots[0], {
    status: 'running',
    results: [],
    negativeControl: { status: 'not-run' },
    types: { status: 'failed', compiler: 'installed-typescript', strict: true, skipLibCheck: false, error: { message: String(error), stack: error.stack, exitCode: 2, stdout: error.stdout, stderr: error.stderr } },
  })
  assert.equal(harness.report.status, 'failed')
  assert.deepEqual(harness.report.results.map(item => item.id), ['first', 'second'])
  assert.deepEqual(harness.report.acceptance, { nativeHostOnly: true, publicTypesPassed: false, applicableScenariosPassed: true, actualWindowsRecovery: false, baselineOriginalRejected: false })
})

it('类型通过保留完整验收与 Windows baseline 门禁', async () => {
  const harness = createHarness()
  await runCandidateValidation(harness.options)
  completePublicValidation(harness.report, 'darwin', 2)
  assert.equal(harness.report.status, 'passed')
  completePublicValidation(harness.report, 'win32', 2)
  assert.equal(harness.report.status, 'incomplete')
})

it('开始前取消不编译也不启动 worker', async () => {
  const harness = createHarness()
  harness.controller.abort()
  await assert.rejects(runCandidateValidation(harness.options), { name: 'AbortError' })
  assert.deepEqual(harness.events, [])
})

it('类型失败期间取消会保留编译结果并阻止全部 worker', async () => {
  const harness = createHarness()
  harness.options.verifyTypes = async () => {
    harness.events.push('types')
    harness.controller.abort()
    throw new Error('compiler interrupted')
  }
  await assert.rejects(runCandidateValidation(harness.options), { name: 'AbortError' })
  assert.deepEqual(harness.events, ['types', 'persist'])
  assert.deepEqual(harness.report.results, [])
})

it('保存类型报告期间取消也不会启动 worker', async () => {
  const harness = createHarness()
  harness.options.persist = async () => {
    harness.events.push('persist')
    harness.controller.abort()
  }
  await assert.rejects(runCandidateValidation(harness.options), { name: 'AbortError' })
  assert.deepEqual(harness.events, ['types', 'persist'])
})

it('报告保存失败直接停止，不作为类型错误吞掉', async () => {
  const harness = createHarness()
  const error = new Error('report persistence failed')
  harness.options.persist = async () => {
    harness.events.push('persist')
    throw error
  }
  await assert.rejects(runCandidateValidation(harness.options), candidate => candidate === error)
  assert.deepEqual(harness.events, ['types', 'persist'])
})

it('前一 worker 后取消不会启动下一场景', async () => {
  const harness = createHarness()
  harness.options.runScenario = async (scenario) => {
    harness.events.push(scenario.id)
    harness.controller.abort()
    return { id: scenario.id, status: 'passed', cleanupConfirmed: true }
  }
  await assert.rejects(runCandidateValidation(harness.options), { name: 'AbortError' })
  assert.deepEqual(harness.events, ['types', 'persist', 'first', 'persist'])
})

it('cleanup 未确认保留该场景结果并阻止下一 worker', async () => {
  const harness = createHarness()
  harness.options.runScenario = async (scenario) => {
    harness.events.push(scenario.id)
    return { id: scenario.id, status: 'failed', cleanupConfirmed: false }
  }
  await assert.rejects(runCandidateValidation(harness.options), /Unconfirmed consumer cleanup/)
  assert.deepEqual(harness.events, ['types', 'persist', 'first', 'persist'])
  assert.deepEqual(harness.report.results, [{ id: 'first', status: 'failed', cleanupConfirmed: false }])
})

it('scope 登记期间取消时精确关闭空 scope，且不启动 child', async () => {
  const controller = new AbortController()
  const events: string[] = []
  const scope = {
    async seal() { events.push('seal') },
    async complete() { events.push('complete') },
  }
  const lease = {
    async createChildScope(binding: { cleanupKey: string }) {
      assert.deepEqual(binding, { cleanupKey: 'owned-scope' })
      events.push('scope')
      controller.abort()
      return scope
    },
  }
  const options = {
    lease,
    cleanupKey: 'owned-scope',
    signal: controller.signal,
    start() { events.push('child') },
  }
  await assert.rejects(preparePublicWorkerScope(options), { name: 'AbortError' })
  assert.deepEqual(events, ['scope', 'seal', 'complete'])
})

it('空 scope 清理失败保留原错，不启动 child 或伪造 complete', async () => {
  const controller = new AbortController()
  const events: string[] = []
  const error = new Error('scope seal failed')
  const lease = {
    async createChildScope() {
      controller.abort()
      return {
        async seal() {
          events.push('seal')
          throw error
        },
        async complete() { events.push('complete') },
      }
    },
  }
  const options = {
    lease,
    cleanupKey: 'owned-scope',
    signal: controller.signal,
    start() { events.push('child') },
  }
  await assert.rejects(preparePublicWorkerScope(options), candidate => candidate === error)
  assert.deepEqual(events, ['seal'])
})
