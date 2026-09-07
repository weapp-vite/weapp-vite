export function omittedAppFiles(appSource = 'require("./shared/entry")'): Array<[string, string]> {
  const pageSource = `
Page({
  data: { state: 'pending' },
  onLoad() {
    const app = getApp()
    app.visits = (app.visits || 0) + 1
    this.setData({ state: 'ready:' + app.visits + ':' + (globalThis.entryReady || 'empty') })
  },
})
`
  return [
    ['project.config.json', JSON.stringify({ appid: 'wx123', miniprogramRoot: '.' })],
    ['app.json', JSON.stringify({
      pages: ['pages/index/index'],
      subPackages: [{ root: 'packageA', pages: ['pages/detail'] }],
    })],
    ['app.js', appSource],
    ['shared/entry.js', 'globalThis.entryReady = "entry"'],
    ['pages/index/index.js', pageSource],
    ['pages/index/index.wxml', '<view id="app-state">{{state}}</view>'],
    ['packageA/pages/detail.js', pageSource],
    ['packageA/pages/detail.wxml', '<view id="app-state">{{state}}</view>'],
  ]
}
