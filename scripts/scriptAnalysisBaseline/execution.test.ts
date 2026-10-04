import type { ScriptScenario } from './types'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createScriptExecution } from './execution'

const mocks = vi.hoisted(() => ({
  install: vi.fn(),
  compile: vi.fn(),
  transform: vi.fn(),
  reserved: vi.fn(),
  reset: vi.fn(),
  idle: vi.fn(),
  snapshot: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('./install', () => ({ installScriptBaseline: mocks.install }))
vi.mock('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile', () => ({ compileVueFile: mocks.compile }))
vi.mock('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/transformScript', () => ({ transformScript: mocks.transform }))
vi.mock('../../packages-runtime/wevu-compiler/src/plugins/vue/transform/compileVueFile/reservedProps', () => ({ warnReservedScriptSetupProps: mocks.reserved }))

const scenario: Extract<ScriptScenario, { kind: 'sfc' }> = {
  id: 'complete-sfc',
  kind: 'sfc',
  source: '<template><view /></template>',
  filename: 'complete.vue',
  options: {},
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.snapshot.mockReturnValue({ astReuse: 1, activeCompiles: 0 })
  mocks.install.mockResolvedValue({
    sourceHashes: { compiler: 'source-digest' },
    reset: mocks.reset,
    assertIdle: mocks.idle,
    snapshot: mocks.snapshot,
    dispose: mocks.dispose,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('keeps reset, input hashing, output serialization and metric snapshots outside the SFC invocation boundary', async () => {
  const events: string[] = []
  const input = { ...scenario }
  Object.defineProperty(input, 'toJSON', { value: () => {
    events.push('hash-input')
    return scenario
  } })
  mocks.reset.mockImplementation(() => events.push('reset'))
  mocks.idle.mockImplementation(() => events.push('idle'))
  mocks.snapshot.mockImplementation(() => {
    events.push('metrics')
    return { astReuse: 1 }
  })
  const value = { code: 'compiled', map: { sources: ['complete.vue'], mappings: 'AAAA' } }
  mocks.compile.mockImplementation(async (_source: string, _filename: string, options: { warn?: (message: string) => void }) => {
    events.push('compile')
    options.warn?.('compiler warning')
    console.warn('console warning', 2)
    return { toJSON() {
      events.push('serialize-output')
      return value
    } }
  })
  const originalWarn = console.warn
  const execution = await createScriptExecution('optimized')
  const result = await execution.execute(input, async (compile) => {
    events.push('start')
    try {
      return await compile()
    }
    finally {
      events.push('stop')
    }
  })
  expect(events).toEqual(['reset', 'hash-input', 'start', 'compile', 'stop', 'idle', 'serialize-output', 'metrics'])
  expect(result).toEqual({
    output: JSON.stringify({ value, warnings: ['compiler warning'], consoleWarnings: ['console warning 2'] }),
    inputSha256: createHash('sha256').update(JSON.stringify(scenario)).digest('hex'),
    failed: false,
    warnings: ['compiler warning', 'console warning 2'],
    metrics: { astReuse: 1 },
  })
  expect(mocks.compile).toHaveBeenCalledWith(scenario.source, scenario.filename, { warn: expect.any(Function) })
  expect(console.warn).toBe(originalWarn)
  expect(execution.sourceHashes).toEqual({ compiler: 'source-digest' })
  execution.dispose()
})

it('preserves public error details and warnings, then starts the next execution with fresh state', async () => {
  const cause = Object.assign(new SyntaxError('Invalid macro'), {
    code: 'INVALID_MACRO',
    severity: 'error',
    filename: scenario.filename,
    source: scenario.source,
    loc: { line: 2, column: 3 },
    cause: 'implementation detail',
  })
  mocks.compile.mockImplementationOnce(async (_source: string, _filename: string, options: { warn?: (message: string) => void }) => {
    options.warn?.('before failure')
    console.warn('console before failure')
    throw cause
  }).mockResolvedValueOnce({ code: 'recovered' })
  const originalWarn = console.warn
  const execution = await createScriptExecution('control')
  const failure = await execution.execute(scenario)
  expect(JSON.parse(failure.output)).toEqual({
    warnings: ['before failure'],
    consoleWarnings: ['console before failure'],
    error: {
      name: 'SyntaxError',
      message: 'Invalid macro',
      code: 'INVALID_MACRO',
      severity: 'error',
      filename: scenario.filename,
      source: scenario.source,
      loc: { line: 2, column: 3 },
    },
  })
  expect(failure.failed).toBe(true)
  expect(console.warn).toBe(originalWarn)
  const recovery = await execution.execute(scenario)
  expect(JSON.parse(recovery.output)).toEqual({ value: { code: 'recovered' }, warnings: [], consoleWarnings: [] })
  expect(recovery.failed).toBe(false)
  expect(recovery.warnings).toEqual([])
  expect(mocks.reset).toHaveBeenCalledTimes(2)
  execution.dispose()
})

it('omits warning callbacks when requested and routes non-SFC correctness checks without invoking the timing wrapper', async () => {
  const execution = await createScriptExecution('baseline')
  const invoke = vi.fn()
  mocks.transform.mockReturnValue({ code: 'raw-script' })
  const script: ScriptScenario = { ...scenario, kind: 'script', source: 'const count = 1', options: {}, withoutWarn: true }
  await execution.execute(script, invoke)
  expect(mocks.transform).toHaveBeenCalledWith(script.source, { warn: undefined })
  const reserved: ScriptScenario = { ...scenario, kind: 'reserved-props', start: { line: 2, column: 1 } }
  await execution.execute(reserved, invoke)
  expect(mocks.reserved).toHaveBeenCalledWith(reserved.source, expect.any(Function), { filename: reserved.filename, scriptSetupStart: reserved.start })
  await execution.execute({ ...scenario, withoutWarn: true })
  expect(mocks.compile).toHaveBeenCalledWith(scenario.source, scenario.filename, { warn: undefined })
  expect(invoke).not.toHaveBeenCalled()
  expect(mocks.install).not.toHaveBeenCalled()
  expect(execution.sourceHashes).toEqual({})
  execution.dispose()
})

it('rejects overlapping execution and disposal during an active compile and disposes exactly once', async () => {
  let release: ((value: unknown) => void) | undefined
  mocks.compile.mockImplementation(() => new Promise(resolve => release = resolve))
  const execution = await createScriptExecution('optimized')
  const active = execution.execute(scenario)
  await expect(execution.execute(scenario)).rejects.toThrow('idle, active owner')
  expect(() => execution.dispose()).toThrow('compile is active')
  release?.({ code: 'complete' })
  await active
  execution.dispose()
  execution.dispose()
  expect(mocks.dispose).toHaveBeenCalledOnce()
  await expect(execution.execute(scenario)).rejects.toThrow('idle, active owner')
})

it.each(['control', 'ast-reuse', 'props-no-scope', 'page-meta-gate', 'reserved-props-gate', 'optimized'] as const)('enables only the requested %s feature set', async (variant) => {
  const execution = await createScriptExecution(variant)
  expect(mocks.install).toHaveBeenCalledExactlyOnceWith({
    mode: variant === 'control' ? 'control' : 'optimized',
    features: {
      astReuse: variant === 'ast-reuse' || variant === 'optimized',
      propsNoScope: variant === 'props-no-scope' || variant === 'optimized',
      pageMetaGate: variant === 'page-meta-gate' || variant === 'optimized',
      reservedPropsGate: variant === 'reserved-props-gate' || variant === 'optimized',
    },
  })
  execution.dispose()
})
