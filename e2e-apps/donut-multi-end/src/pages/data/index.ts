Page({
  data: {
    activeTab: 'runtime',
    kpis: [
      { title: '启动耗时', value: '328ms', trend: 'stable', percent: 78 },
      { title: '页面数', value: '5', trend: 'expanded', percent: 100 },
      { title: '配置完整度', value: '100%', trend: 'ready', percent: 100 },
    ],
    runtimeRows: [
      { title: 'projectArchitecture', note: 'multiPlatform' },
      { title: 'miniprogramRoot', note: 'dist' },
      { title: 'app.miniapp.json', note: 'identity sidecar emitted' },
    ],
    platformRows: [
      { title: 'Android SDK', note: '1.5.2 / toolkit 0.11.0' },
      { title: 'iOS SDK', note: '1.6.8 / toolkit 0.0.9' },
      { title: 'HarmonyOS SDK', note: '0.5.4' },
    ],
  },
  onTabChange(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    this.setData({
      activeTab: event.detail.value,
    })
  },
  refreshData() {
    wx.showToast({
      title: '数据已刷新',
      icon: 'none',
    })
  },
})
