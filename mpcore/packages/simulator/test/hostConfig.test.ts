import { describe, expect, it } from 'vitest'
import { createMiniProgramHostConfig } from '../src/project/hostConfig'

describe('simulator host config', () => {
  it('preserves an explicit custom tabBar list without mutating app config', () => {
    const appConfig = { tabBar: { custom: false, list: [{ pagePath: 'pages/home/index' }] } }
    const override = { tabBar: { custom: true, list: [{ pagePath: 'pages/custom/index' }] } }
    const config = createMiniProgramHostConfig(appConfig, override)
    expect(config.tabBar).toEqual(override.tabBar)
    expect(appConfig.tabBar.list).toEqual([{ pagePath: 'pages/home/index' }])
    expect(override.tabBar.list).toEqual([{ pagePath: 'pages/custom/index' }])
  })

  it('exposes app tabBar paths in the host .html shape', () => {
    const config = createMiniProgramHostConfig({
      pages: ['pages/login/index', 'pages/home/index'],
      tabBar: {
        list: [
          { pagePath: 'pages/home/index', text: 'Home' },
          { pagePath: '/pages/profile/index.html', text: 'Profile' },
        ],
      },
    })

    expect(config.tabBar.list).toEqual([
      { pagePath: 'pages/home/index.html', text: 'Home' },
      { pagePath: 'pages/profile/index.html', text: 'Profile' },
    ])
  })

  it('keeps explicit host config fields while deriving missing app fields', () => {
    const config = createMiniProgramHostConfig(
      { pages: ['pages/home/index'], tabBar: { list: [{ pagePath: 'pages/home/index' }] } },
      { tabBar: { custom: true }, scene: 1001 },
    )

    expect(config.scene).toBe(1001)
    expect(config.tabBar).toMatchObject({ custom: true, list: [{ pagePath: 'pages/home/index.html' }] })
  })
})
