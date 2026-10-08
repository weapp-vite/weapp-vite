import { describe, expect, it, vi } from 'vitest'
import { decodeCapturedData, readCapturedStageResult } from './captureRead'
import { TransformScriptCaptureState } from './captureState'

const expressions = { isExpression: () => false, generate: () => ({ code: '' }) }

describe('actual transformScript boundary capture state', () => {
  it('preserves original options, callback receiver, result identity and full map', async () => {
    const state = new TransformScriptCaptureState(() => undefined)
    const receiver = { marker: 'warn receiver' }
    const warn = vi.fn()
    const options = Object.freeze({ warn, sourceMap: true, absent: undefined })
    const output = { code: 'export const x = "🙂"', transformed: true, map: { version: 3, names: [], sources: ['inline.ts'], mappings: 'AAAA', sourcesContent: ['🙂'] } }
    const { value, records } = await state.run('synthetic', () => state.invoke('🙂', options, () => {
      state.fastSetup(false)
      const handler = state.warningHandler(warn)
      Reflect.apply(handler, receiver, ['notice', { detail: 1 }])
      expect(options.warn).toBe(warn)
      return output
    }, expressions))
    expect(value).toBe(output)
    expect(warn.mock.contexts).toEqual([receiver])
    expect(warn.mock.calls).toEqual([['notice', { detail: 1 }]])
    expect(records[0]).toMatchObject({ fastSetup: 'miss', status: 'returned', source: { code: '🙂', utf16Length: 2, utf8Bytes: 4 } })
    expect(readCapturedStageResult(records[0])).toEqual(output)
    expect(decodeCapturedData(records[0].warnings[0].arguments)).toEqual(['notice', { detail: 1 }])
    expect(records[0].warnings[0].channel).toBe('handler')
    state.dispose()
    state.dispose()
  })

  it('captures a fastSetup hit without requiring warn handler resolution', async () => {
    const state = new TransformScriptCaptureState(() => undefined)
    const { records } = await state.run('fast', () => state.invoke('', undefined, () => {
      state.fastSetup(true)
      return { code: '', transformed: false }
    }, expressions))
    expect(records[0]).toMatchObject({ fastSetup: 'hit', options: { kind: 'undefined' }, warnings: [] })
  })

  it('retains both warning channels without swallowing or duplicating public callback delivery', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const state = new TransformScriptCaptureState(() => undefined)
      const { records } = await state.run('default-warn', () => state.invoke('', {}, () => {
        state.fastSetup(false)
        state.warningHandler((message: string) => console.warn(message))('warning')
        return { code: '', transformed: false }
      }, expressions))
      expect(records[0].warnings.map(warning => warning.channel)).toEqual(['handler', 'console'])
      expect(consoleWarn).toHaveBeenCalledExactlyOnceWith('warning')
      expect(console.warn).toBe(consoleWarn)
    }
    finally {
      consoleWarn.mockRestore()
    }
  })

  it('records a real stage error with incomplete fastSetup and rethrows the same error', async () => {
    const state = new TransformScriptCaptureState(() => undefined)
    const error = new Error('fast path failed')
    await expect(state.run('throws', () => state.invoke('', {}, () => {
      throw error
    }, expressions))).rejects.toBe(error)
    expect(state.snapshot()[0]).toMatchObject({ status: 'threw', fastSetup: 'not-observed', error: { message: 'fast path failed' }, captureFailures: [] })
    expect(() => readCapturedStageResult(state.snapshot()[0])).toThrow('successful result')
  })

  it('surfaces capture failure even if an outer compiler serializes it', async () => {
    const state = new TransformScriptCaptureState(() => undefined)
    const compile = vi.fn()
    await expect(state.run('swallowed', () => {
      try {
        state.invoke('', { unknown: () => {} }, compile, expressions)
      }
      catch {
        return { failed: true }
      }
    })).rejects.toThrow('serialized compiler errors do not hide')
    expect(compile).not.toHaveBeenCalled()
    expect(state.snapshot()[0]).toMatchObject({ status: 'capture-failed', fastSetup: 'not-observed', captureFailures: [{ message: 'Unsupported function at $.unknown' }] })
  })

  it.each(['missing', 'duplicate'] as const)('rejects %s fastSetup instrumentation', async (mode) => {
    const state = new TransformScriptCaptureState(() => undefined)
    await expect(state.run('bad-hook', () => state.invoke('', {}, () => {
      if (mode === 'duplicate') {
        state.fastSetup(false)
        state.fastSetup(false)
      }
      return { code: '', transformed: false }
    }, expressions))).rejects.toThrow(mode === 'duplicate' ? 'exactly one' : 'omitted')
    expect(state.snapshot()[0].captureFailures).toHaveLength(1)
  })

  it('guards sequential lifecycle and returns snapshots detached from retained evidence', async () => {
    const state = new TransformScriptCaptureState(() => undefined)
    let release: () => void = () => {}
    const running = state.run('pending', () => new Promise<void>((resolve) => {
      release = resolve
    }))
    expect(() => state.dispose()).toThrow('during a run')
    await expect(state.run('overlap', () => {})).rejects.toThrow('during a run')
    release()
    await running
    await state.run('single', () => state.invoke('', {}, () => {
      state.fastSetup(true)
      return { code: '', transformed: false }
    }, expressions))
    state.snapshot()[0].source.code = 'corrupt copy'
    expect(state.snapshot()[0].source.code).toBe('')
    state.dispose()
    await expect(state.run('disposed', () => {})).rejects.toThrow('active owner')
  })
})
