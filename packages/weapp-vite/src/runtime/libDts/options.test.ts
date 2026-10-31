import type { Options } from 'rolldown-plugin-dts'
import { resolveOptions } from 'rolldown-plugin-dts'
import { describe, expect, it, vi } from 'vitest'
import { normalizeRolldownDtsOptions } from './options'

function resolve(options: Options = {}) {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const normalized = normalizeRolldownDtsOptions({ generator: 'tsc', tsconfig: false, ...options, logger })
  const resolved = resolveOptions(normalized)
  expect(logger.warn).not.toHaveBeenCalled()
  return { normalized, resolved }
}

describe('rolldown dts option compatibility', () => {
  it('uses isolated tsc contexts without enabling the plugin Vue pipeline', () => {
    const { resolved } = resolve()
    expect(resolved.tsc.newContext).toBe(true)
    expect(resolved.tsc.vue).toBe(false)
  })

  it('passes legacy compiler settings through the upstream namespaced contract without warnings', () => {
    const { normalized, resolved } = resolve({
      build: true,
      incremental: true,
      parallel: true,
      eager: true,
      newContext: false,
      vue: true,
    })
    expect(resolved.tsc).toEqual({
      build: true,
      incremental: true,
      parallel: true,
      eager: true,
      newContext: true,
      vue: false,
    })
    for (const key of ['build', 'incremental', 'parallel', 'eager', 'newContext', 'vue']) {
      expect(normalized).not.toHaveProperty(key)
    }
  })

  it.each([false, true])('prefers explicit tsc settings over conflicting legacy settings: %s', (preferred) => {
    const { resolved } = resolve({
      build: !preferred,
      incremental: !preferred,
      parallel: !preferred,
      eager: !preferred,
      tsc: { build: preferred, incremental: preferred, parallel: preferred, eager: preferred },
      compilerOptions: { incremental: !preferred },
    })
    expect(resolved.tsc.build).toBe(preferred)
    expect(resolved.tsc.incremental).toBe(preferred)
    expect(resolved.tsc.parallel).toBe(preferred)
    expect(resolved.tsc.eager).toBe(preferred)
  })

  it('falls back to legacy settings when a namespaced value is undefined', () => {
    const { resolved } = resolve({ build: true, eager: true, tsc: { build: undefined, parallel: true } })
    expect(resolved.tsc.build).toBe(true)
    expect(resolved.tsc.eager).toBe(true)
    expect(resolved.tsc.parallel).toBe(true)
  })

  it('keeps compiler options at the top level and does not mutate either input configuration', () => {
    const options: Options = {
      newContext: false,
      vue: true,
      compilerOptions: { allowJs: false, allowImportingTsExtensions: false },
      tsc: { newContext: false, vue: true, eager: true },
    }
    const original = structuredClone(options)
    const { normalized, resolved } = resolve(options)
    expect(normalized.compilerOptions).toEqual(options.compilerOptions)
    expect(resolved.tsconfigRaw.compilerOptions?.allowJs).toBe(false)
    expect(resolved.tsconfigRaw.compilerOptions?.allowImportingTsExtensions).toBe(false)
    expect(resolved.tsc.newContext).toBe(true)
    expect(resolved.tsc.vue).toBe(false)
    expect(resolved.tsc.eager).toBe(true)
    expect(options).toEqual(original)
  })
})
