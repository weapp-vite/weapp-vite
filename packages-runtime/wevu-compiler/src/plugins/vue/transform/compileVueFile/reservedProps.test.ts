import { beforeEach, describe, expect, it, vi } from 'vitest'
import { warnReservedScriptSetupProps } from './reservedProps'

const parse = vi.hoisted(() => vi.fn())
vi.mock('../../../../utils/babel', async (original) => {
  const actual = await original<typeof import('../../../../utils/babel')>()
  parse.mockImplementation(actual.parseJsLike)
  return { ...actual, parseJsLike: parse }
})

beforeEach(() => {
  parse.mockClear()
})

describe('reserved props native diagnostic reuse', () => {
  it.each([
    'defineProps({ id: String })',
    'const emoji = "😀"; defineProps(["class"])',
    'const emoji = "😀";\r\n  defineProps({ slot: String })',
    'const emoji = "😀";\u2028defineProps(["id"])',
    '(defineProps)(({ id: String }))',
  ])('preserves Babel warning text and source locations for %s', (code) => {
    const context = { filename: 'src/component.vue', scriptSetupStart: { line: 3, column: 8 } }
    const baselineWarn = vi.fn()
    warnReservedScriptSetupProps(code, baselineWarn, context)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(baselineWarn).toHaveBeenCalledTimes(1)
    parse.mockClear()
    const nativeWarn = vi.fn()
    warnReservedScriptSetupProps(code, nativeWarn, context, {
      warningOffset: code.startsWith('(') ? 0 : code.indexOf('defineProps'),
    })
    expect(nativeWarn.mock.calls).toEqual(baselineWarn.mock.calls)
    expect(parse).not.toHaveBeenCalled()
  })

  it('does not parse or warn for a completed negative native diagnostic', () => {
    const warn = vi.fn()
    warnReservedScriptSetupProps('defineProps({ title: String })', warn, {}, {})
    expect(parse).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it.each([
    'defineProps({ id: String })',
    'interface Props { class: string }; defineProps<Props>()',
    'type Props = { slot: string } & { title: string }; defineProps<Props>()',
  ])('executes one fallback parse for old bindings or unsupported types: %s', (code) => {
    const warn = vi.fn()
    warnReservedScriptSetupProps(code, warn, {}, undefined)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
