Page({
  data: {
    __e2eResult: {
      status: 'ready',
      projectArchitecture: 'multiPlatform',
      entry: 'index',
    },
    metrics: [
      { label: 'App 配置', value: 'project.miniapp.json', percent: 100 },
      { label: '运行根', value: 'dist/app.miniapp.json', percent: 100 },
      { label: 'TDesign', value: 'enabled', percent: 92 },
    ],
    quickRoutes: [
      { text: '数据', path: '/pages/data/index', icon: 'chart-bubble' },
      { text: '表单', path: '/pages/form/index', icon: 'edit-1' },
      { text: '能力', path: '/pages/ability/index', icon: 'app' },
      { text: '资料', path: '/pages/profile/index?from=index', icon: 'user' },
    ],
    checklist: [
      { title: '多端项目标记', note: 'projectArchitecture=multiPlatform' },
      { title: '运行时配置', note: 'app.miniapp.json sidecar' },
      { title: '原生页面', note: 'Page + WXML + TDesign' },
    ],
  },
  openRoute(event: WechatMiniprogram.BaseEvent<{ path?: string }>) {
    const url = event.currentTarget.dataset.path
    if (!url) {
      return
    }
    wx.navigateTo({
      url,
    })
  },
})
