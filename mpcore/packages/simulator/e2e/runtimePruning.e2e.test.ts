// @ts-expect-error Node 侧构建真实 Wevu runtime，浏览器消费与单测相同的 fixture。
import sources, { publicFactorySources } from 'virtual:runtime-pruning-fixture'
import { expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders a page without router guards, updates child props and restarts across a subpackage', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => preview.innerHTML = session.renderCurrentPage().wxml
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.readSnapshot()).toEqual({ count: 0, phase: 'setup', trace: ['setup', 'load'] })
    await vi.waitFor(() => expect(page.readSnapshot()).toEqual({ count: 0, phase: 'mounted', trace: ['setup', 'load', 'mounted'] }))
    await page.flush()
    render()
    expect(preview.querySelector('#pruning-phase')?.textContent).toBe('mounted')
    expect(preview.querySelector('#pruning-count')?.textContent).toBe('0')
    const button = preview.querySelector('#pruning-increment')!
    session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, { type: 'tap' })
    await page.flush()
    render()
    expect(preview.querySelector('#pruning-count')?.textContent).toBe('1')
    expect(preview.querySelector('#pruning-doubled')?.textContent).toBe('2')
    expect(preview.querySelector('#pruning-child-value')?.textContent).toBe('1')

    const detail = session.reLaunch('/detail/index')
    await vi.waitFor(() => expect(detail.data.phase).toBe('mounted'))
    await detail.flush()
    render()
    expect(preview.querySelector('#pruning-detail')?.textContent).toBe('mounted')
    const reopened = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(reopened.readSnapshot()).toEqual({ count: 0, phase: 'mounted', trace: ['setup', 'load', 'mounted'] }))
    await reopened.flush()
    render()
    expect(preview.querySelector('#pruning-count')?.textContent).toBe('0')
    expect(preview.querySelector('#pruning-phase')?.textContent).toBe('mounted')
    expect(reopened).not.toBe(page)
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('dispatches a rendered JSX island button from an uncompiled dynamic public factory', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(publicFactorySources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => preview.innerHTML = session.renderCurrentPage().wxml
  try {
    const page = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(page.readSnapshot()).toEqual({ count: 0, phase: 'mounted' }))
    render()
    expect(preview.querySelector('#public-factory-phase')?.textContent).toBe('mounted')
    const button = preview.querySelector('#public-factory-increment')!
    session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, {
      type: 'tap',
      currentTarget: { dataset: { wvJsxHandler: button.getAttribute('data-wv-jsx-handler') } },
    })
    await page.flush()
    render()
    expect(preview.querySelector('#public-factory-count')?.textContent).toBe('1')
    const restarted = session.reLaunch('/pages/index/index')
    await vi.waitFor(() => expect(restarted.readSnapshot()).toEqual({ count: 0, phase: 'mounted' }))
    render()
    expect(preview.querySelector('#public-factory-count')?.textContent).toBe('0')
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
