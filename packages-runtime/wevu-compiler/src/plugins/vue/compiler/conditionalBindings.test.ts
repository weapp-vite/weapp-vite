import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { generate, parse } from '../../../utils/babel'
import { buildClassStyleComputedCode } from '../transform/classStyleComputed'
import { compileVueTemplateToWxml } from './template'

function compileBindings(template: string, options?: Parameters<typeof compileVueTemplateToWxml>[2]) {
  const compiled = compileVueTemplateToWxml(template, 'conditional-bindings.vue', options)
  expect(compiled.diagnostics).toEqual([])
  const bindings = compiled.classStyleBindings ?? []
  const code = buildClassStyleComputedCode(bindings, {
    unrefName: '__wevuUnref',
    normalizeClassName: '__normalizeClass',
    normalizeStyleName: '__normalizeStyle',
  })
  const error = vi.fn()
  const computed = runInNewContext(`(${code})`, {
    __wevuUnref: (value: unknown) => value,
    __wevuResolvePropValue: (_context: unknown, _key: string, value: unknown) => value,
    __normalizeClass: (value: unknown) => value,
    __normalizeStyle: (value: unknown) => value,
    console: { error, warn: vi.fn() },
  }) as Record<string, (this: Record<string, unknown>) => unknown>
  return {
    error,
    evaluate(state: Record<string, unknown>) {
      const context = { ...state, $state: state, __wevuProps: {} }
      for (const [name, getter] of Object.entries(computed)) {
        Object.defineProperty(context, name, { get: () => getter.call(context), configurable: true })
      }
      return Object.fromEntries(bindings.map(binding => [binding.exp, computed[binding.name]!.call(context)]))
    },
  }
}

function createScopedRuntime(script: string, owner: Record<string, unknown>, slotProps: Record<string, unknown>) {
  const ast = parse(script, { sourceType: 'module' })
  ast.program.body = ast.program.body.filter(node => node.type !== 'ImportDeclaration')
  let computed: Record<string, (this: Record<string, unknown>) => unknown> = {}
  const error = vi.fn()
  runInNewContext(generate(ast).code, {
    _installScopedSlots: vi.fn(),
    _createWevuScopedSlotComponent: (options: { computed: typeof computed }) => { computed = options.computed },
    __wevuUnref: (value: unknown) => value,
    console: { error, warn: vi.fn() },
  })
  const context = { __wvOwnerProxy: owner, __wvSlotPropsData: slotProps }
  for (const [name, getter] of Object.entries(computed)) {
    Object.defineProperty(context, name, { get: () => getter.call(context) })
  }
  return { error, evaluate: () => Object.values(computed).map(getter => getter.call(context)) }
}

describe('conditional runtime binding evaluation', () => {
  it.each(['auto', 'off'] as const)('guards expressions declared directly on a named slot template: %s', (scopedSlotsCompiler) => {
    const runtime = compileBindings('<t-cell><template #title v-if="address">{{ mask(address.phone) }}</template></t-cell>', { scopedSlotsCompiler })
    const mask = vi.fn((value: string) => `masked:${value}`)
    runtime.evaluate({ address: null, mask })
    expect(runtime.error).not.toHaveBeenCalled()
    expect(mask).not.toHaveBeenCalled()
    expect(Object.values(runtime.evaluate({ address: { phone: '123' }, mask }))).toContain('masked:123')
  })

  it('short circuits conditions and content in a named-slot sibling chain', () => {
    const runtime = compileBindings('<t-cell><template #title v-if="primary">{{ show(primary.name) }}</template><template #title v-else-if="accepts(alternate.name)">{{ show(alternate.name) }}</template><template #title v-else>{{ empty() }}</template></t-cell>')
    const show = vi.fn((value: string) => value)
    const accepts = vi.fn(() => true)
    const empty = vi.fn(() => 'empty')
    runtime.evaluate({ primary: { name: 'primary' }, alternate: null, show, accepts, empty })
    expect(runtime.error).not.toHaveBeenCalled()
    expect(show).toHaveBeenCalledExactlyOnceWith('primary')
    expect(accepts).not.toHaveBeenCalled()
    expect(empty).not.toHaveBeenCalled()
    show.mockClear()
    runtime.evaluate({ primary: null, alternate: { name: 'secondary' }, show, accepts, empty })
    expect(show).toHaveBeenCalledExactlyOnceWith('secondary')
    expect(empty).not.toHaveBeenCalled()
    show.mockClear()
    accepts.mockReturnValue(false)
    runtime.evaluate({ primary: null, alternate: { name: 'rejected' }, show, accepts, empty })
    expect(show).not.toHaveBeenCalled()
    expect(empty).toHaveBeenCalledOnce()
    expect(runtime.error).not.toHaveBeenCalled()
  })

  it('keeps an augmented slot declaration guard on the owner instance', () => {
    const compiled = compileVueTemplateToWxml('<card><template #title="{ item }" v-if="enabled()">{{ format(item.name) }}</template></card>', 'conditional-slot-declaration.vue', { scopedSlotsCompiler: 'augmented' })
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.scopedSlotComponents).toHaveLength(1)
    const guard = compiled.classStyleBindings?.find(binding => binding.exp === 'enabled()')
    expect(guard).toBeDefined()
    const format = vi.fn((value: string) => `formatted:${value}`)
    const owner = { [guard!.name]: false, format }
    const props: { item: null | { name: string } } = { item: null }
    const runtime = createScopedRuntime(compiled.scopedSlotComponents![0]!.script, owner, props)
    expect(runtime.evaluate()).toEqual([undefined])
    expect(format).not.toHaveBeenCalled()
    owner[guard!.name] = true
    props.item = { name: 'selected' }
    expect(runtime.evaluate()).toEqual(['formatted:selected'])
    expect(format).toHaveBeenCalledExactlyOnceWith('selected')
    owner[guard!.name] = false
    props.item = null
    expect(runtime.evaluate()).toEqual([undefined])
    expect(runtime.error).not.toHaveBeenCalled()
  })

  it('does not evaluate calls inside an inactive component slot branch', () => {
    const runtime = compileBindings('<t-cell v-if="address && address.detail"><template #title>{{ mask(address.phone) }}</template></t-cell>')
    const mask = vi.fn((value: string) => `masked:${value}`)
    runtime.evaluate({ address: null, mask })
    expect(runtime.error).not.toHaveBeenCalled()
    expect(mask).not.toHaveBeenCalled()
    expect(Object.values(runtime.evaluate({ address: { detail: 'Home', phone: '123' }, mask }))).toContain('masked:123')
    mask.mockClear()
    runtime.evaluate({ address: undefined, mask })
    expect(runtime.error).not.toHaveBeenCalled()
    expect(mask).not.toHaveBeenCalled()
  })

  it('short circuits previous sibling branches, including else-if conditions', () => {
    const runtime = compileBindings('<view v-if="primary">{{ show(primary.name) }}</view><!-- branch --><view v-else-if="alternate && accepts(alternate.name)">{{ show(alternate.name) }}</view><view v-else>{{ fallback() }}</view>')
    const show = vi.fn((value: string) => value)
    const accepts = vi.fn(() => true)
    const fallback = vi.fn(() => 'empty')
    runtime.evaluate({ primary: { name: 'primary' }, alternate: null, show, accepts, fallback })
    expect(runtime.error).not.toHaveBeenCalled()
    expect(show.mock.calls).toEqual([['primary']])
    expect(accepts).not.toHaveBeenCalled()
    expect(fallback).not.toHaveBeenCalled()
    show.mockClear()
    runtime.evaluate({ primary: null, alternate: { name: 'alternate' }, show, accepts, fallback })
    expect(show.mock.calls).toEqual([['alternate']])
    expect(fallback).not.toHaveBeenCalled()
    runtime.evaluate({ primary: null, alternate: null, show, accepts, fallback })
    expect(fallback).toHaveBeenCalledOnce()
    expect(runtime.error).not.toHaveBeenCalled()
  })

  it('keeps nested template conditions and class/style expressions lazy', () => {
    const runtime = compileBindings('<template v-if="enabled"><view v-if="item" :class="classes(item.name)" :style="styles(item.name)">{{ show(item.name) }}</view><view v-else>{{ empty() }}</view></template>')
    const classes = vi.fn(() => 'active')
    const styles = vi.fn(() => 'color:red')
    const show = vi.fn((value: string) => value)
    const empty = vi.fn(() => 'empty')
    runtime.evaluate({ enabled: false, item: null, classes, styles, show, empty })
    expect(runtime.error).not.toHaveBeenCalled()
    for (const fn of [classes, styles, show, empty]) {
      expect(fn).not.toHaveBeenCalled()
    }
    runtime.evaluate({ enabled: true, item: { name: 'selected' }, classes, styles, show, empty })
    for (const fn of [classes, styles, show]) {
      expect(fn).toHaveBeenCalledExactlyOnceWith('selected')
    }
    expect(empty).not.toHaveBeenCalled()
  })

  it('guards a loop source before traversal and each nullable row before evaluation', () => {
    const runtime = compileBindings('<template v-if="group"><view v-for="(row, i) in group.rows"><text v-if="row">{{ show(row.name) }}</text></view></template>')
    const show = vi.fn((value: string) => value)
    runtime.evaluate({ group: null, show })
    expect(runtime.error).not.toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
    runtime.evaluate({ group: { rows: [null, { name: 'visible' }] }, show })
    expect(show).toHaveBeenCalledExactlyOnceWith('visible')
    expect(runtime.error).not.toHaveBeenCalled()
  })

  it('uses local computed guards and owner state in a fresh scoped-slot component', () => {
    const compiled = compileVueTemplateToWxml(
      '<card v-if="ownerReady" v-slot="{ item }"><text v-if="visible && item">{{ format(item.name) }}</text><text v-else>{{ empty() }}</text></card>',
      'conditional-slot.vue',
      { scopedSlotsCompiler: 'augmented' },
    )
    expect(compiled.diagnostics).toEqual([])
    expect(compiled.scopedSlotComponents).toHaveLength(1)
    const asset = compiled.scopedSlotComponents![0]!
    const format = vi.fn((value: string) => `formatted:${value}`)
    const empty = vi.fn(() => 'empty')
    const owner = { visible: false, format, empty }
    const slotProps: { item: null | { name: string } } = { item: null }
    const { evaluate, error } = createScopedRuntime(asset.script, owner, slotProps)
    expect(evaluate()).toContain('empty')
    expect(format).not.toHaveBeenCalled()
    owner.visible = true
    slotProps.item = { name: 'selected' }
    expect(evaluate()).toContain('formatted:selected')
    expect(format).toHaveBeenCalledExactlyOnceWith('selected')
    expect(empty).toHaveBeenCalledOnce()
    slotProps.item = null
    expect(evaluate()).toContain('empty')
    expect(format).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it('preserves guards between projected loops and clears hidden branch values', () => {
    const runtime = compileBindings('<view v-for="(group, gi) in groups" :key="group.id || gi"><template v-if="group.rows"><text v-for="(row, ri) in group.rows" :key="row.id || ri">{{ show(row.name) }}</text></template></view>')
    const show = vi.fn((value: string) => value)
    const state = { groups: [{ id: 'first', rows: null as null | { id: string, name: string }[] }], show }
    runtime.evaluate(state)
    expect(runtime.error).not.toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
    state.groups[0]!.rows = [{ id: 'row', name: 'visible' }]
    expect(Object.values(runtime.evaluate(state))).toContainEqual([['visible']])
    expect(runtime.error).not.toHaveBeenCalled()
    state.groups[0]!.rows = null
    expect(Object.values(runtime.evaluate(state))).toContainEqual([[]])
    expect(runtime.error).not.toHaveBeenCalled()
  })
})
