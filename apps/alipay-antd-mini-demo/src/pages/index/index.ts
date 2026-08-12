Page({
  data: {
    nativeCount: 1,
  },
  handleNativeChange(next: number) {
    this.setData({
      nativeCount: next,
    })
  },
  openWevuPage() {
    my.navigateTo({
      url: '/pages/wevu/index',
    })
  },
  openNativeSubpackage() {
    my.navigateTo({
      url: '/package-native/pages/detail/index',
    })
  },
})
