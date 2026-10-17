import type { HeadlessTestingLogicalNode, HeadlessTestingPageHandle, HeadlessTestingPageSnapshot } from '@mpcore/simulator'
import { describe, expect, it } from 'vitest'
import { MiniProgramScreen } from './index'

function element(nodeId: string, text: string, children: HeadlessTestingLogicalNode[] = []): HeadlessTestingLogicalNode {
  return { attrs: { 'data-testid': 'panel', 'title': text }, children, nodeId, tag: 'view', text, type: 'element' }
}

function createScreen(root: HeadlessTestingLogicalNode) {
  let snapshot: HeadlessTestingPageSnapshot = { data: {}, path: '/fixture', query: {}, root, wxml: '<view />' }
  const page = {
    assertActive() {},
    async snapshot() { return snapshot },
  } as unknown as HeadlessTestingPageHandle
  return {
    replace(nextRoot: HeadlessTestingLogicalNode) { snapshot = { ...snapshot, root: nextRoot } },
    screen: new MiniProgramScreen(page, snapshot),
  }
}

describe('shared mini-program query snapshots', () => {
  it('refreshes retained within queries and node values through the root screen', async () => {
    const { replace, screen } = createScreen(element('panel-1', 'before'))
    const panel = screen.getByTestId('panel')
    const scoped = screen.within(panel)
    replace(element('panel-1', 'after'))

    await screen.refresh()

    expect(scoped.getByText('after').textContent).toBe('after')
    expect(scoped.getByTestId('panel').getAttribute('title')).toBe('after')
    expect(panel.textContent).toBe('after')
  })

  it('publishes refreshes from a nested within query to sibling and parent queries', async () => {
    const { replace, screen } = createScreen(element('outer', 'before', [element('inner', 'before')]))
    const outer = screen.within(screen.getAllByTestId('panel')[0]!)
    const inner = outer.within(outer.getAllByTestId('panel')[1]!)
    replace(element('outer', 'after', [element('inner', 'after')]))

    await inner.refresh()

    expect(screen.getByText('after').textContent).toBe('after')
    expect(outer.getByText('after').textContent).toBe('after')
  })

  it('does not redirect a retained scope to a different runtime nodeId with the same test id', async () => {
    const { replace, screen } = createScreen(element('panel-1', 'before'))
    const panel = screen.getByTestId('panel')
    const scoped = screen.within(panel)
    replace(element('panel-2', 'replacement'))

    await screen.refresh()

    expect(panel.isConnected).toBe(false)
    expect(() => scoped.getByTestId('panel')).toThrow('within() root is no longer present')
    expect(() => panel.textContent).toThrow('node is no longer present')
    expect(screen.getByTestId('panel').nodeId).toBe('panel-2')
  })
})
