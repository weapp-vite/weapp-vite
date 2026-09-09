import { describe, expect, it } from 'vitest'
import { assertResponsiveCalcStyle, assertResponsiveStyle } from './styles'

describe('real IDE rpx calculation expectations', () => {
  it.each([
    { value: 8, multiply: 24, actual: '96px' },
    { value: 8, multiply: 32, actual: '128px' },
    { value: 8, multiply: 8, actual: '32px' },
    { value: 40, multiply: 1.4, actual: '28px' },
    { value: 60, multiply: 1.2, actual: '37.2px' },
  ])('converts the $value rpx atom before multiplying by $multiply', ({ value, multiply, actual }) => {
    expect(() => assertResponsiveCalcStyle(actual, { value, multiply }, 390, 'probe')).not.toThrow()
  })

  it.each(['99px', '99.84px', '96.01px', '95px'])('rejects the incorrect calculated width %s', (actual) => {
    expect(() => assertResponsiveCalcStyle(actual, { value: 8, multiply: 24 }, 390, 'width')).toThrow('= 96px')
  })

  it.each(['29px', '29.12px', '28.01px'])('rejects the incorrect unitless line height %s', (actual) => {
    expect(() => assertResponsiveCalcStyle(actual, { value: 40, multiply: 1.4 }, 390, 'line-height')).toThrow('= 28px')
  })

  it('preserves direct rpx lengths as a separate conversion', () => {
    expect(() => assertResponsiveStyle('99px', 192, 390, 'direct width')).not.toThrow()
    expect(() => assertResponsiveStyle('29px', 56, 390, 'direct line-height')).not.toThrow()
    expect(() => assertResponsiveStyle('96px', 192, 390, 'direct width')).toThrow('expected 192rpx')
  })

  it.each([undefined, 0, -390, Number.NaN, Number.POSITIVE_INFINITY])('rejects missing or invalid window dimensions %s', (windowWidth) => {
    expect(() => assertResponsiveCalcStyle('96px', { value: 8, multiply: 24 }, windowWidth, 'width')).toThrow('Invalid responsive calculation evidence')
  })

  it.each([
    { value: 1, multiply: 24 },
    { value: -8, multiply: 24 },
    { value: Number.NaN, multiply: 24 },
    { value: 8, multiply: 0 },
    { value: 8, multiply: -1 },
    { value: 8, multiply: Number.POSITIVE_INFINITY },
  ])('rejects unsupported atoms and invalid multipliers: %j', (calculation) => {
    expect(() => assertResponsiveCalcStyle('96px', calculation, 390, 'width')).toThrow('Invalid responsive calculation evidence')
  })

  it.each([undefined, '96rpx', 'calc(4px * 24)', 'normal'])('requires actual computed pixel evidence: %s', (actual) => {
    expect(() => assertResponsiveCalcStyle(actual, { value: 8, multiply: 24 }, 390, 'width')).toThrow('Invalid responsive calculation evidence')
  })

  it('does not guess the minimum-pixel rule or accept overflow', () => {
    expect(() => assertResponsiveCalcStyle('24px', { value: 8, multiply: 24 }, 1, 'width')).toThrow('Unsupported responsive calculation')
    expect(() => assertResponsiveCalcStyle('96px', { value: 8, multiply: Number.MAX_VALUE }, 390, 'width')).toThrow('Unsupported responsive calculation')
  })
})
