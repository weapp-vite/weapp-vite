// @ts-expect-error Node 侧构建真实 wevu 与 #1049 Store 后注入虚拟文件。
import sources from 'virtual:store-lifecycle-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('renders shared computed after page and child subscription disposal', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/launch/index')
    await page.flush()
    render()
    expect(preview.querySelector('#child')?.textContent).toBe('subscribed')
    await page.mutate()
    await page.remove()
    render()
    expect(preview.querySelector('#child')).toBeNull()
    const hidden = session.navigateTo('/pages/result/index')
    await hidden.mutate()
    expect(hidden.snapshot()).toMatchObject({ page: 2, child: 1 })
    page.start()
    const result = session.reLaunch('/pages/result/index')
    await result.mutate()
    await result.finish()
    render()
    expect(preview.querySelector('#count')?.textContent).toBe('3')
    expect(preview.querySelector('#doubled')?.textContent).toBe('6')
    expect(result.snapshot()).toMatchObject({ page: 2, child: 1, detached: 3, after: 1, errors: 1 })
    expect(result.dispose()).toBe(3)
    result.boundaries()
    await expect.poll(() => result.boundarySnapshot()).toMatchObject({
      patch: ['patch object:2', 'patch function:3', 'direct:4'],
      pluginDuring: [],
      pluginSync: ['direct:3'],
      pluginAsync: ['direct:1', 'direct:3'],
      identity: true,
      rawNested: true,
      shallowDuring: [],
      shallowEvents: ['direct', 'direct'],
      values: [5, 6],
    })
    render()
    expect(preview.querySelector('#boundaries')?.textContent).toBe('patch:3 shallow:2 plugin:1')
  }
  finally {
    session.close()
    preview.remove()
  }
})
