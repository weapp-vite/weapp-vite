import { describe, expect, it } from 'vitest'
import { resolveStyleUnitOptions } from '../src/shared/styleUnits/options'
import { transformStyleValue } from '../src/shared/styleUnits/value'

const runtimeOptions = resolveStyleUnitOptions()

describe('shared style value units', () => {
  it.each([
    ['+1e2RPX', 'calc(var(--rpx) * 100)'],
    ['-.5rpx', 'calc(var(--rpx) * -0.5)'],
    [String.raw`10r\70x`, 'calc(var(--rpx) * 10)'],
    ['calc(100vh - 455rpx)', 'calc(var(--weapp-viewport-height) - calc(var(--rpx) * 455))'],
  ])('transforms complete rpx and viewport dimensions in %s', (source, expected) => {
    expect(transformStyleValue(source, runtimeOptions)).toBe(expected)
  })

  it('applies the configured static ratio and keeps viewport units static', () => {
    const options = resolveStyleUnitOptions({ pxPerRpx: 0.25 })
    expect(transformStyleValue('calc(100vh - 455rpx) 1.23456rpx', options))
      .toBe('calc(100vh - 113.75px) 0.309px')
  })

  it('uses the configured variable when a design width wins over a static ratio', () => {
    const options = resolveStyleUnitOptions({ pxPerRpx: 0.25, designWidth: 375, rpxVar: '--unit' })
    expect(transformStyleValue('10rpx 100vw', options)).toBe('calc(var(--unit) * 10) var(--weapp-viewport-width)')
  })

  it.each([
    'url("100rpx-50vw.png")',
    'URL(100rpx)',
    String.raw`u\72 l("env(safe-area-inset-top) 10rpx")`,
    '"env(safe-area-inset-top) 100rpx 50vh"',
    '/* env(safe-area-inset-top) 100rpx */',
    'var(--size-100rpx)',
    '100rpx-name',
    '#100rpx',
    '1e999rpx',
    '100dvw',
    'var(--weapp-viewport-width, 100vw)',
    'var(--weapp-viewport-height, 100dvh)',
    'var( /* runtime fallback */ --weapp-viewport-width, calc(100vw - 1px))',
  ])('preserves literal and runtime fallback tokens in %s', (source) => {
    expect(transformStyleValue(source, runtimeOptions)).toBe(source)
  })

  it('preserves safe-area fallbacks and comments while converting their dimensions', () => {
    expect(transformStyleValue('env(/* side */ safe-area-inset-top, max(10rpx, env(safe-area-inset-bottom, 2px)))', runtimeOptions))
      .toBe('var(/* side */ --weapp-safe-area-inset-top, max(calc(var(--rpx) * 10), var(--weapp-safe-area-inset-bottom, 2px)))')
  })

  it('only maps the four safe-area names and preserves unrelated env functions', () => {
    const source = 'env(titlebar-area-height, 0px) env(safe-area-inset-top-extra, 0px)'
    expect(transformStyleValue(source, runtimeOptions)).toBe(source)
    expect(transformStyleValue('ENV(SAFE-AREA-INSET-TOP)', runtimeOptions)).toBe('var(--weapp-safe-area-inset-top)')
  })

  it('converts dimensions after a protected function and remains idempotent', () => {
    const source = 'url("100rpx.png") 10rpx var(--weapp-viewport-width,100vw) calc(50vh + env(safe-area-inset-top, 2rpx))'
    const result = transformStyleValue(source, runtimeOptions)
    expect(result).toBe('url("100rpx.png") calc(var(--rpx) * 10) var(--weapp-viewport-width,100vw) calc(calc(var(--weapp-viewport-height) * 50 / 100) + var(--weapp-safe-area-inset-top, calc(var(--rpx) * 2)))')
    expect(transformStyleValue(result, runtimeOptions)).toBe(result)
  })
})
