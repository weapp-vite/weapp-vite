import { describe, expect, it } from 'vitest'
import {
  coerceBooleanOption,
  convertBase,
  filterDuplicateOptions,
  isUiEnabled,
  resolveConfigFile,
} from './options'

describe('cli options helpers', () => {
  it('filters duplicate array options by keeping the last value', () => {
    const options: any = {
      mode: ['dev', 'prod'],
      config: ['a.ts', 'b.ts'],
      plain: 'ok',
    }

    filterDuplicateOptions(options)
    expect(options).toEqual({
      mode: 'prod',
      config: 'b.ts',
      plain: 'ok',
    })
  })

  it('resolves config file with config > c priority', () => {
    expect(resolveConfigFile({ config: 'a.ts', c: 'b.ts' } as any)).toBe('a.ts')
    expect(resolveConfigFile({ c: 'b.ts' } as any)).toBe('b.ts')
    expect(resolveConfigFile({} as any)).toBeUndefined()
  })

  it('converts base value according to cli convention', () => {
    expect(convertBase(0)).toBe('')
    expect(convertBase('/base/')).toBe('/base/')
  })

  it('coerces boolean-like options from different value types', () => {
    expect(coerceBooleanOption(undefined)).toBeUndefined()
    expect(coerceBooleanOption(true)).toBe(true)
    expect(coerceBooleanOption(false)).toBe(false)
    expect(coerceBooleanOption('')).toBe(true)
    expect(coerceBooleanOption('false')).toBe(false)
    expect(coerceBooleanOption('0')).toBe(false)
    expect(coerceBooleanOption('off')).toBe(false)
    expect(coerceBooleanOption('no')).toBe(false)
    expect(coerceBooleanOption('true')).toBe(true)
    expect(coerceBooleanOption('1')).toBe(true)
    expect(coerceBooleanOption('on')).toBe(true)
    expect(coerceBooleanOption('yes')).toBe(true)
    expect(coerceBooleanOption('random')).toBe(true)
    expect(coerceBooleanOption(0)).toBe(false)
    expect(coerceBooleanOption(1)).toBe(true)
    expect(coerceBooleanOption({})).toBe(true)
  })

  it('enables ui mode from ui or analyze flags', () => {
    expect(isUiEnabled({ ui: true })).toBe(true)
    expect(isUiEnabled({ analyze: true })).toBe(true)
    expect(isUiEnabled({ ui: false, analyze: false })).toBe(false)
  })
})
