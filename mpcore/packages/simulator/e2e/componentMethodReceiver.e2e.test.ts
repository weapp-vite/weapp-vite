import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentMethodReceiverFiles } from '../test/helpers/componentMethodReceiver'

it('keeps component method receivers, rendered state and single error side effects isolated in a browser', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentMethodReceiverFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    session.reLaunch('/pages/index/index')
    const first = session.selectComponent('#first')!
    const second = session.selectComponent('#second')!
    const scopeId = session.getScopeIdForComponent(first)!
    first.setData({ label: 'component-updated' })
    render()
    expect(preview.querySelector('#first .component-label')?.textContent).toBe('component-updated')

    expect(session.callScopeMethodDirect(scopeId, 'mark', 'component-method')).toBe('component:component-method')
    render()
    expect(preview.querySelector('#first .component-label')?.textContent).toBe('component-method')
    expect(preview.querySelector('#second .component-label')?.textContent).toBe('component-initial')
    expect(first.data).toMatchObject({ label: 'component-method', previousLabel: 'component-updated', calls: 1 })
    expect(second.data).toMatchObject({ label: 'component-initial', previousLabel: '', calls: 0 })

    expect(() => session.callScopeMethodDirect(scopeId, 'fail')).toThrow('component-method-failed')
    await expect(session.callScopeMethodDirect(scopeId, 'failAsync')).rejects.toThrow('component-method-failed-async')
    render()
    expect(first.data).toMatchObject({ calls: 1, syncFailures: 1, asyncFailures: 1 })
    expect(second.data).toMatchObject({ calls: 0, syncFailures: 0, asyncFailures: 0 })
    expect(preview.querySelector('#first .component-label')?.textContent).toBe('component-method')
    expect(preview.querySelector('#second .component-label')?.textContent).toBe('component-initial')
    expect(session.selectComponent('#first')).toBe(first)
    expect(session.selectComponent('#second')).toBe(second)

    expect(session.callScopeMethodDirect(scopeId, 'completeWithoutValue')).toBeUndefined()
    render()
    expect(preview.querySelector('#first .component-label')?.textContent).toBe('undefined-method')
    expect(first.data).toMatchObject({ undefinedCalls: 1, asyncCalls: 0 })
    await expect(session.callScopeMethodDirect(scopeId, 'completeAsync', 'async-method')).resolves.toEqual({ label: 'async-method', calls: 1 })
    render()
    expect(preview.querySelector('#first .component-label')?.textContent).toBe('async-method')
    expect(first.data).toMatchObject({ undefinedCalls: 1, asyncCalls: 1 })
    expect(second.data).toMatchObject({ label: 'component-initial', undefinedCalls: 0, asyncCalls: 0 })
    expect(preview.querySelector('#second .component-label')?.textContent).toBe('component-initial')
  }
  finally {
    session.close()
    preview.remove()
  }
})
