import { describe, expect, it } from 'vitest'
import { normalizeWebTabBarConfig } from '../src/shared/tabBar'

describe('normalizeWebTabBarConfig', () => {
  it('normalizes app.json tabBar defaults and paths', () => {
    expect(normalizeWebTabBarConfig({
      list: [
        { pagePath: '/pages/home/index', text: '首页' },
        { pagePath: 'pages/settings/index', text: '设置', selectedIconPath: 'icons/settings-active.png' },
      ],
    })).toEqual({
      color: '#7a7e83',
      selectedColor: '#3cc51f',
      backgroundColor: '#ffffff',
      borderStyle: 'black',
      position: 'bottom',
      custom: false,
      list: [
        { pagePath: 'pages/home/index', text: '首页', iconPath: undefined, selectedIconPath: undefined },
        {
          pagePath: 'pages/settings/index',
          text: '设置',
          iconPath: undefined,
          selectedIconPath: 'icons/settings-active.png',
        },
      ],
    })
  })

  it('drops invalid items and preserves custom top tab bars', () => {
    expect(normalizeWebTabBarConfig({
      custom: true,
      position: 'top',
      borderStyle: 'white',
      list: [{ text: 'missing path' }, null, { pagePath: 'pages/home/index' }],
    })).toMatchObject({
      custom: true,
      position: 'top',
      borderStyle: 'white',
      list: [{ pagePath: 'pages/home/index', text: '' }],
    })
    expect(normalizeWebTabBarConfig({ list: [] })).toBeUndefined()
    expect(normalizeWebTabBarConfig(null)).toBeUndefined()
    expect(normalizeWebTabBarConfig([])).toBeUndefined()
    expect(normalizeWebTabBarConfig({ list: [[], 'invalid', { pagePath: '   ' }] })).toBeUndefined()
  })

  it('normalizes explicit colors and optional icon whitespace', () => {
    expect(normalizeWebTabBarConfig({
      color: '#111111',
      selectedColor: '#222222',
      backgroundColor: '#333333',
      list: [{
        pagePath: '/pages/home/index',
        text: ' Home ',
        iconPath: ' ',
        selectedIconPath: 'active.png',
      }],
    })).toMatchObject({
      color: '#111111',
      selectedColor: '#222222',
      backgroundColor: '#333333',
      list: [{
        pagePath: 'pages/home/index',
        text: ' Home ',
        iconPath: undefined,
        selectedIconPath: 'active.png',
      }],
    })
  })
})
