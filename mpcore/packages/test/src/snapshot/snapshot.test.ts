import type { HeadlessTestingLogicalNode, HeadlessTestingPageHandle, HeadlessTestingPageSnapshot } from '@mpcore/simulator'
import { collectMiniProgramEventBindings } from '@mpcore/simulator'
import { describe, expect, it } from 'vitest'
import { MiniProgramScreen } from '../screen'
import { mpcoreSnapshotSerializer, toMiniProgramSnapshot } from './index'

function diagnosticSnapshot(): HeadlessTestingPageSnapshot {
  const child: HeadlessTestingLogicalNode = {
    attrs: {
      'title': 'public-a83cd',
      'data-v-a83cd': '',
      'data-v-public': 'keep',
      'data-sim-node': 'unstable-node',
      'capture-catch:tap': '__generated_capture_a83cd',
      'catch:change': 'onChange',
      'bindtap': '__generated_inline_a83cd',
      'bind:empty': '',
      'aria-label': '保存',
    },
    children: [{ attrs: {}, children: [], text: ' 保存\n', type: 'text' }],
    nodeId: 'unstable-child',
    tag: 'button',
    text: ' 保存\n',
    type: 'element',
  }
  return {
    data: { internalHelper: '__generated_a83cd', count: 1 },
    path: '/fixture',
    query: { from: 'test' },
    root: { attrs: { id: 'root' }, children: [child], nodeId: 'unstable-root', tag: 'view', text: child.text, type: 'element' },
    wxml: '<view data-sim-node="unstable-root" />',
  }
}

function createScreen(snapshot: HeadlessTestingPageSnapshot) {
  const page = {
    assertActive() {},
    async snapshot() { return snapshot },
  } as unknown as HeadlessTestingPageHandle
  return new MiniProgramScreen(page, snapshot)
}

describe('stable mini-program tree snapshots', () => {
  it('keeps public structure, exact text and event semantics while removing internal identities', () => {
    const diagnostic = diagnosticSnapshot()
    const before = structuredClone(diagnostic)
    const snapshot = toMiniProgramSnapshot(diagnostic)

    expect(snapshot).toEqual({
      attributes: { id: 'root' },
      children: [{
        attributes: {
          'aria-label': '保存',
          'bind:empty': '',
          'bindtap': '[handler]',
          'capture-catch:tap': '[handler]',
          'catch:change': '[handler]',
          'data-v-public': 'keep',
          'title': 'public-a83cd',
        },
        children: [{ text: ' 保存\n' }],
        tag: 'button',
      }],
      tag: 'view',
    })
    expect(diagnostic).toEqual(before)
    expect(mpcoreSnapshotSerializer.test(diagnostic)).toBe(false)
    expect(JSON.stringify(snapshot)).not.toContain('unstable')
    expect(JSON.stringify(snapshot)).not.toContain('__generated')
    if ('children' in snapshot && 'attributes' in snapshot.children[0]!) {
      expect(Object.keys(snapshot.children[0].attributes)).toEqual([
        'aria-label',
        'bind:empty',
        'bindtap',
        'capture-catch:tap',
        'catch:change',
        'data-v-public',
        'title',
      ])
    }
  })

  it('serializes retained screens, scoped screens and nodes from their shared current tree', async () => {
    const diagnostic = diagnosticSnapshot()
    const screen = createScreen(diagnostic)
    const button = screen.getByRole('button')
    const scoped = screen.within(button)
    const original = toMiniProgramSnapshot(button)
    diagnostic.root.children[0]!.children[0]!.text = '已保存'
    diagnostic.root.children[0]!.text = '已保存'
    await screen.refresh()

    expect(toMiniProgramSnapshot(button)).toEqual(toMiniProgramSnapshot(scoped))
    expect(toMiniProgramSnapshot(button)).not.toEqual(original)
    expect(mpcoreSnapshotSerializer.test(screen)).toBe(true)
    expect(mpcoreSnapshotSerializer.test(button)).toBe(true)
    expect(mpcoreSnapshotSerializer.serialize(button)).toBe(JSON.stringify(toMiniProgramSnapshot(button), null, 2))
  })

  it('ignores attribute insertion order and compiler helper changes without hiding public attribute changes', () => {
    const first = diagnosticSnapshot()
    const second = diagnosticSnapshot()
    second.root.nodeId = 'new-identity'
    const attrs = second.root.children[0]!.attrs
    second.root.children[0]!.attrs = Object.fromEntries(Object.entries(attrs).reverse())
    second.root.children[0]!.attrs.bindtap = '__generated_different'
    second.root.children[0]!.attrs['data-v-a83cd'] = 'different'

    expect(toMiniProgramSnapshot(first)).toEqual(toMiniProgramSnapshot(second))
    second.root.children[0]!.attrs.title = 'public changed'
    expect(toMiniProgramSnapshot(first)).not.toEqual(toMiniProgramSnapshot(second))
    second.root.children[0]!.attrs['catch:tap'] = 'onCatch'
    expect(toMiniProgramSnapshot(second)).toHaveProperty('children.0.attributes.catch:tap', '[handler]')
  })

  it.each(['change.detail', 'update:label', 'custom-event', ':phase', '.phase', '-phase', ':', '.', '-'])(
    'normalizes handlers for custom event bindings parsed by the runtime: %s',
    (eventName) => {
      const first = diagnosticSnapshot()
      const prefixes = ['bind', 'catch', 'capture-bind', 'capture-catch']
      first.root.attrs = Object.fromEntries(prefixes.map(prefix => [`${prefix}:${eventName}`, 'firstGeneratedHandler']))
      const second = structuredClone(first)
      second.root.attrs = Object.fromEntries(prefixes.map(prefix => [`${prefix}:${eventName}`, 'secondGeneratedHandler']))

      expect(collectMiniProgramEventBindings({ [`bind:${eventName}`]: 'firstGeneratedHandler' }).get(eventName)).toEqual({
        method: 'firstGeneratedHandler',
        stopAfter: false,
      })
      expect(toMiniProgramSnapshot(first)).toMatchObject({
        attributes: Object.fromEntries(prefixes.map(prefix => [`${prefix}:${eventName}`, '[handler]'])),
      })
      expect(toMiniProgramSnapshot(first)).toEqual(toMiniProgramSnapshot(second))
      expect(mpcoreSnapshotSerializer.serialize(createScreen(first))).toBe(mpcoreSnapshotSerializer.serialize(createScreen(second)))
    },
  )

  it.each(['bindchange.detail', 'catchchange-detail', 'capture-bindchange:detail', 'bind:'])(
    'preserves attributes that the runtime does not parse as event bindings: %s',
    (attribute) => {
      const diagnostic = diagnosticSnapshot()
      diagnostic.root.attrs = { [attribute]: 'public value' }

      expect(collectMiniProgramEventBindings(diagnostic.root.attrs).size).toBe(0)
      expect(toMiniProgramSnapshot(diagnostic)).toMatchObject({ attributes: { [attribute]: 'public value' } })
    },
  )

  it('rejects retained node snapshots when only a different runtime nodeId has the same test id', async () => {
    const diagnostic = diagnosticSnapshot()
    diagnostic.root.children[0]!.attrs['data-testid'] = 'save'
    const screen = createScreen(diagnostic)
    const node = screen.getByTestId('save')
    const scoped = screen.within(node)
    diagnostic.root.children = [{ ...diagnostic.root.children[0]!, nodeId: 'different-runtime-node' }]
    await screen.refresh()

    expect(screen.getByTestId('save').nodeId).toBe('different-runtime-node')
    expect(() => toMiniProgramSnapshot(node)).toThrow('node is no longer present')
    expect(() => toMiniProgramSnapshot(scoped)).toThrow('within() root is no longer present')
  })
})
