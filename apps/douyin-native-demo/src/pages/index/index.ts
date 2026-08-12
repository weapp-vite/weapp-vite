Page({
  data: {
    nativeCount: 1,
    npmMessage: '等待 npm 组件事件',
  },
  handleNativeChange(event: { detail: { value: number } }) {
    this.setData({ nativeCount: event.detail.value })
  },
  handleNpmConfirm(event: { detail: { label: string } }) {
    this.setData({ npmMessage: `已收到：${event.detail.label}` })
  },
  openNativeSubpackage() {
    tt.navigateTo({ url: '/package-native/pages/detail/index' })
  },
  openWevuPage() {
    tt.navigateTo({ url: '/pages/wevu/index' })
  },
})
