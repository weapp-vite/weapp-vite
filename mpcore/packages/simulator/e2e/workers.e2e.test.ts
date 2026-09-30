import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { workerFiles } from '../test/helpers/workers'

it('renders worker startup, cloned messages and a fresh worker after reentry', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(workerFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const text = (selector: string) => {
    preview.innerHTML = session.renderCurrentPage().wxml
    return preview.querySelector(selector)?.textContent
  }
  try {
    session.reLaunch('/pages/index')
    await expect.poll(() => text('.message')).toBe('worker hello')
    const button = preview.querySelector<HTMLButtonElement>('button')!
    await session.callScopeMethod(button.dataset.simScope!, button.dataset.simTap!)
    await expect.poll(() => text('.message')).toBe('echo')
    expect(preview.querySelector('.count')?.textContent).toBe('1')
    session.reLaunch('/pages/index')
    await expect.poll(() => text('.message')).toBe('worker hello')
    expect(preview.querySelector('.count')?.textContent).toBe('0')
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})
