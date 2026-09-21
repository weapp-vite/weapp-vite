// @ts-expect-error Node 侧构建真实 Wevu runtime，由浏览器消费相同的冷启动 fixture。
import sources from 'virtual:router-bootstrap-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders the App router on cold start, named navigation and back', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const home = session.reLaunch('/pages/home/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#router-state')?.textContent).toBe('true')
    expect(home.readTrace()).toEqual(['app:setup', 'app:router-created', 'app:onLaunch', 'home:setup'])
    await home.openNext()
    expect(session.getCurrentPages().at(-1)?.route).toBe('pages/next/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#router-state')?.textContent).toBe('true')
    await session.getCurrentPages().at(-1)!.goBack()
    expect(session.getCurrentPages().at(-1)).toBe(home)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#router-state')?.textContent).toBe('true')
    expect(home.readTrace().filter((event: string) => event === 'app:setup')).toHaveLength(1)
  }
  finally {
    session.close()
    preview.remove()
  }
})
