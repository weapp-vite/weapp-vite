// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureTabBar,
  ensureTabBarDefined,
  setTabBarBadgeState,
  syncTabBarRoute,
} from '../src/runtime/appShell/tabBar'

const config = {
  color: '#666666',
  selectedColor: '#07c160',
  backgroundColor: '#ffffff',
  borderStyle: 'black' as const,
  position: 'bottom' as const,
  custom: false,
  list: [
    { pagePath: 'pages/home/index', text: 'Home' },
    { pagePath: 'pages/settings/index', text: 'Settings' },
  ],
}

describe('tab bar detached and failure boundaries', () => {
  afterEach(() => {
    configureTabBar(undefined, async () => {})
    document.body.replaceChildren()
  })

  it('ignores detached renders and rejected switch handlers', async () => {
    ensureTabBarDefined()
    const detached = document.createElement('weapp-tab-bar') as any
    detached.renderTabBar()

    const app = document.createElement('div')
    app.id = 'app'
    document.body.append(app)
    const switchTab = vi.fn(async () => {
      throw new Error('navigation failed')
    })
    configureTabBar(config, switchTab)
    syncTabBarRoute('pages/home/index')
    const tabBar = app.querySelector('weapp-tab-bar')!
    ;(tabBar as any).connectedCallback()
    tabBar.shadowRoot!.querySelectorAll('button')[1]!.click()
    await Promise.resolve()
    await Promise.resolve()
    expect(switchTab).toHaveBeenCalledWith('/pages/settings/index')

    setTabBarBadgeState(1, '2')
    expect(tabBar.shadowRoot!.querySelectorAll('img')).toHaveLength(0)
    expect(tabBar.shadowRoot!.querySelector('.weapp-tab-bar__badge')?.textContent).toBe('2')
  })
})
