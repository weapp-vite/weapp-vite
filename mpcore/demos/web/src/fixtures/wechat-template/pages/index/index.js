const require_common = require('../../common.js')
// #region src/pages/index/index.vue
var HOME_PATH = '/pages/index/index'
var OVERVIEW_PATH = '/pages/overview/index'
var WORKSPACE_PATH = '/packageA/pages/workspace/index'
var SETTINGS_PATH = '/packageB/pages/settings/index'
var LAYOUTS_PATH = '/pages/layouts/index'
Page(require_common.createWevuComponent({
  data: {
    metrics: [
      {
        label: '本周跟进事项',
        value: '12',
        detail: '含 3 项需今日确认',
      },
      {
        label: '交付进度',
        value: '86%',
        detail: '版本提测准备完成',
      },
      {
        label: '服务可用率',
        value: '99.95%',
        detail: '核心链路运行稳定',
      },
    ],
  },
  openOverview() {
    wx.navigateTo({
      url: OVERVIEW_PATH,
    })
  },
  openWorkspace() {
    wx.navigateTo({
      url: WORKSPACE_PATH,
    })
  },
  openSettings() {
    wx.navigateTo({
      url: SETTINGS_PATH,
    })
  },
  openLayouts() {
    wx.navigateTo({
      url: LAYOUTS_PATH,
    })
  },
}))
