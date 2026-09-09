import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createAppLaunchOptionsFiles } from '../test/helpers/appLaunchOptions'

it('renders the complete non-default App boundary inputs after startup and later navigation', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createAppLaunchOptionsFiles()) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.bootstrap({
      path: 'pages/index/index',
      query: { from: '分享入口', encoded: 'a&b=1' },
      scene: 1047,
      referrerInfo: { appId: 'wx9876543210abcdef', extraData: {} },
    })
    for (let visit = 0; visit < 2; visit++) {
      session.reLaunch('/pages/index/index?from=%E5%88%86%E4%BA%AB%E5%85%A5%E5%8F%A3&encoded=a%26b%3D1')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#page-query')?.textContent).toBe('{"from":"分享入口","encoded":"a&b=1"}')
      const expectedOptions = {
        path: 'pages/index/index',
        query: { from: '分享入口', encoded: 'a&b=1' },
        scene: 1047,
        referrerInfo: { appId: 'wx9876543210abcdef', extraData: {} },
      }
      expect(JSON.parse(preview.querySelector('#launch-options')!.textContent!)).toEqual(expectedOptions)
      if (visit === 0) {
        expect(JSON.parse(preview.querySelector('#enter-options')!.textContent!)).toEqual(expectedOptions)
      }
      expect(Array.from(preview.querySelectorAll('.hook'), node => node.id)).toEqual(['onLaunch', 'onShow'])
      for (const hook of ['onLaunch', 'onShow']) {
        expect(preview.querySelector(`#${hook} .path`)?.textContent).toBe('pages/index/index')
        expect(preview.querySelector(`#${hook} .query`)?.textContent).toBe('{"from":"分享入口","encoded":"a&b=1"}')
        expect(preview.querySelector(`#${hook} .scene`)?.textContent).toBe('1047')
        expect(preview.querySelector(`#${hook} .referrer`)?.textContent).toBe('{"appId":"wx9876543210abcdef","extraData":{}}')
      }
      session.reLaunch('/pages/next/index?from=later')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('.hook')).toBeNull()
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('renders empty referrer information for normal first-page startup and sync options APIs', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createAppLaunchOptionsFiles()) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.reLaunch('/pages/index/index?from=entry')
    preview.innerHTML = session.renderCurrentPage().wxml
    for (const hook of ['onLaunch', 'onShow']) {
      expect(preview.querySelector(`#${hook} .path`)?.textContent).toBe('pages/index/index')
      expect(preview.querySelector(`#${hook} .scene`)?.textContent).toBe('1001')
      expect(preview.querySelector(`#${hook} .referrer`)?.textContent).toBe('{}')
    }
    for (const selector of ['#launch-options', '#enter-options']) {
      expect(JSON.parse(preview.querySelector(selector)!.textContent!)).toEqual({
        path: 'pages/index/index',
        query: { from: 'entry' },
        referrerInfo: {},
        scene: 1001,
      })
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
