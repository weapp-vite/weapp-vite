import { expect, it, vi } from 'vitest'

vi.mock('node:async_hooks', () => {
  throw new Error('Browser compiler must not load Node async hooks')
})
vi.mock('node:perf_hooks', () => {
  throw new Error('Browser compiler must not load Node performance hooks')
})
vi.mock('node:process', () => {
  throw new Error('Browser compiler must not load Node process APIs')
})

it('imports and executes the compiler measurement facade without Node capabilities', async () => {
  const { countCompilerOperation, measureCompilerStage, measureCompilerStageAsync } = await import('./internal')
  const value = { compiled: true }
  const pending = Promise.resolve(value)
  const failure = new Error('compile failed')

  expect(measureCompilerStage('transformScript', () => value)).toBe(value)
  expect(measureCompilerStageAsync('compileVueFile', () => pending)).toBe(pending)
  expect(() => measureCompilerStage('transformScript', () => {
    throw failure
  })).toThrow(failure)
  await expect(measureCompilerStageAsync('compileVueFile', async () => {
    throw failure
  })).rejects.toBe(failure)
  expect(() => countCompilerOperation('babelParseCalls')).not.toThrow()
})
