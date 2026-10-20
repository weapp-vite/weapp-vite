export const configReloadRoute = '/pages/index/index'
export const configReloadTitles = ['SNAPSHOT_BASE', 'SNAPSHOT_CONFIG', 'SNAPSHOT_BASE'] as const
export const configReloadReadyLifecycle = ['app:launch', 'app:show', 'page:load', 'page:show', 'page:ready']

export function createConfigReloadAppJson(title: string) {
  return JSON.stringify({
    pages: ['pages/index/index'],
    window: { navigationBarTitleText: title },
  })
}

/** 仅提供配置往返的运行态语义，不模拟 IDE 文件监听或自动重载。 */
export function createConfigReloadFiles(): Array<[string, string]> {
  return [
    ['project.config.json', '{"miniprogramRoot":"."}'],
    ['app.json', createConfigReloadAppJson(configReloadTitles[0])],
    ['app.js', `App({
      globalData: { lifecycle: [] },
      onLaunch() { this.globalData.lifecycle.push('app:launch') },
      onShow() { this.globalData.lifecycle.push('app:show') },
    })`],
    ['pages/index/index.json', '{}'],
    ['pages/index/index.js', `Page({
      data: { count: 0, ready: false, title: '' },
      onLoad() {
        getApp().globalData.lifecycle.push('page:load')
        this.setData({ title: __wxConfig.window.navigationBarTitleText })
      },
      onShow() { getApp().globalData.lifecycle.push('page:show') },
      onReady() {
        getApp().globalData.lifecycle.push('page:ready')
        this.setData({ ready: true })
      },
      onUnload() { getApp().globalData.lifecycle.push('page:unload') },
      increment() { this.setData({ count: this.data.count + 1 }) },
    })`],
    ['pages/index/index.wxml', '<view id="title">{{title}}</view><view id="ready">{{ready}}</view><button id="increment" bindtap="increment">{{count}}</button>'],
  ]
}
