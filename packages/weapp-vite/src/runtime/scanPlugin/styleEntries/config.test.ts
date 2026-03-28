import { afterEach, describe, expect, it, vi } from 'vitest'
import logger from '../../../logger'
import {
  coerceScope,
  coerceStyleConfig,
  DEFAULT_SCOPED_EXTENSIONS,
  SUPPORTED_SHARED_STYLE_EXTENSIONS,
} from './config'

describe('styleEntries config', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps supported default scoped extensions aligned with supported style extensions', () => {
    expect(DEFAULT_SCOPED_EXTENSIONS).toEqual(SUPPORTED_SHARED_STYLE_EXTENSIONS)
  })

  it('coerces known scopes and falls back to all for empty values', () => {
    expect(coerceScope('pages')).toBe('pages')
    expect(coerceScope('components')).toBe('components')
    expect(coerceScope(' all ')).toBe('all')
    expect(coerceScope(undefined)).toBe('all')
  })

  it('warns for unknown scopes and falls back to all', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})

    expect(coerceScope(' custom ')).toBe('all')
    expect(warnSpy).toHaveBeenCalledWith('[分包] 未识别的样式作用域 `custom`，已按 `all` 处理。')
  })

  it('coerces string style config entries', () => {
    expect(coerceStyleConfig(' ./shared/index.scss ')).toEqual({
      source: './shared/index.scss',
      scope: 'all',
      explicitScope: false,
    })

    expect(coerceStyleConfig('   ')).toBeUndefined()
  })

  it('coerces object style config entries and preserves explicit scope markers', () => {
    expect(coerceStyleConfig({
      source: 'shared/pages.scss',
      include: ['pages/**'],
      exclude: ['pages/internal/**'],
    })).toEqual({
      source: 'shared/pages.scss',
      scope: 'all',
      include: ['pages/**'],
      exclude: ['pages/internal/**'],
      explicitScope: false,
    })

    expect(coerceStyleConfig({
      source: 'shared/components.scss',
      scope: 'components',
    })).toEqual({
      source: 'shared/components.scss',
      scope: 'components',
      include: undefined,
      exclude: undefined,
      explicitScope: true,
    })
  })

  it('ignores invalid object config entries', () => {
    expect(coerceStyleConfig(null as any)).toBeUndefined()
    expect(coerceStyleConfig({} as any)).toBeUndefined()
    expect(coerceStyleConfig({ source: '   ' } as any)).toBeUndefined()
  })
})
