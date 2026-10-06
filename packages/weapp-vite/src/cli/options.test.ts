import { describe, expect, it } from 'vitest'
import {
  coerceBooleanOption,
  convertBase,
  filterDuplicateOptions,
  isUiEnabled,
  parseDashboardUiHost,
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

  it('keeps an omitted UI host unset and UI disabled without opt-in flags', () => {
    const uiHost = parseDashboardUiHost(undefined)
    expect(uiHost).toBeUndefined()
    expect(isUiEnabled({})).toBe(false)
    expect(isUiEnabled({ uiHost, ui: false, analyze: false })).toBe(false)
  })

  it.each(['standalone', 'hub'] as const)('enables UI when the %s host is explicitly selected', (value) => {
    const uiHost = parseDashboardUiHost(value)
    expect(uiHost).toBe(value)
    expect(isUiEnabled({ uiHost })).toBe(true)
    expect(isUiEnabled({ uiHost, ui: false, analyze: false })).toBe(true)
  })

  it.each(['', 'Hub', 'STANDALONE', ' hub', 'standalone ', 'other', false, true, null, 0])('rejects invalid UI host %j with supported choices', (value) => {
    expect(() => parseDashboardUiHost(value)).toThrow(/--ui-host.*standalone.*hub/)
  })

  it('enables ui mode from ui or analyze flags', () => {
    expect(isUiEnabled({ ui: true })).toBe(true)
    expect(isUiEnabled({ analyze: true })).toBe(true)
    expect(isUiEnabled({ ui: false, analyze: false })).toBe(false)
  })
})
