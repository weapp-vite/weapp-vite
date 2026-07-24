import { describe, expect, it, vi } from 'vitest'
import {
  configureTabBar,
  getTabBarPagePaths,
} from '../src/runtime/appShell/tabBar'
import { TAB_BAR_STYLE } from '../src/runtime/appShell/tabBar/style'
import {
  hideTabBar,
  hideTabBarRedDot,
  removeTabBarBadge,
  setTabBarBadge,
  setTabBarItem,
  setTabBarStyle,
  showTabBar,
  showTabBarRedDot,
} from '../src/runtime/polyfill/uiMediaApi'

const tabBarConfig = {
  color: '#666666',
  selectedColor: '#07c160',
  backgroundColor: '#ffffff',
  borderStyle: 'black' as const,
  position: 'bottom' as const,
  custom: false,
  list: [
    { pagePath: 'pages/home/index', text: '首页' },
    { pagePath: 'pages/settings/index', text: '设置' },
  ],
}

describe('web tabBar runtime', () => {
  it('keeps route ownership and default layout in one runtime', () => {
    configureTabBar(tabBarConfig, async () => {})
    expect([...getTabBarPagePaths()]).toEqual([
      'pages/home/index',
      'pages/settings/index',
    ])
    expect(TAB_BAR_STYLE).toContain('height: calc(50px + var(--weapp-safe-area-inset-bottom, 0px))')
    expect(TAB_BAR_STYLE).toContain('font-size: 10px')
  })

  it('updates visibility, appearance, items, badges and red dots through wx-shaped APIs', async () => {
    configureTabBar(tabBarConfig, async () => {})
    const success = vi.fn()

    await expect(hideTabBar({ animation: true })).resolves.toEqual({ errMsg: 'hideTabBar:ok' })
    await expect(showTabBar({ success })).resolves.toEqual({ errMsg: 'showTabBar:ok' })
    expect(success).toHaveBeenCalledWith({ errMsg: 'showTabBar:ok' })
    await expect(setTabBarItem({ index: 1, text: '我的' })).resolves.toEqual({ errMsg: 'setTabBarItem:ok' })
    await expect(setTabBarStyle({ selectedColor: '#ff0000', borderStyle: 'white' })).resolves.toEqual({ errMsg: 'setTabBarStyle:ok' })
    await expect(setTabBarBadge({ index: 1, text: '8' })).resolves.toEqual({ errMsg: 'setTabBarBadge:ok' })
    await expect(removeTabBarBadge({ index: 1 })).resolves.toEqual({ errMsg: 'removeTabBarBadge:ok' })
    await expect(showTabBarRedDot({ index: 0 })).resolves.toEqual({ errMsg: 'showTabBarRedDot:ok' })
    await expect(hideTabBarRedDot({ index: 0 })).resolves.toEqual({ errMsg: 'hideTabBarRedDot:ok' })
  })

  it('keeps visibility APIs compatible without config and rejects invalid item indexes', async () => {
    configureTabBar(tabBarConfig, async () => {})
    await expect(setTabBarItem({ index: 9, text: 'missing' })).rejects.toEqual({
      errMsg: 'setTabBarItem:fail invalid index',
    })

    configureTabBar(undefined, async () => {})
    await expect(hideTabBar()).resolves.toEqual({ errMsg: 'hideTabBar:ok' })
  })
})
