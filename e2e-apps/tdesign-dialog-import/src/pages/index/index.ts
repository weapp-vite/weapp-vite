interface ProbeCard {
  desc: string
  route: string
  title: string
}

const cards: ProbeCard[] = [
  {
    title: 'dialog bare import',
    route: '/pages/dialog-bare/index',
    desc: '验证 import Dialog/Toast from tdesign-miniprogram/*',
  },
  {
    title: 'dialog index import',
    route: '/pages/dialog-index/index',
    desc: '验证 import Dialog/Toast from tdesign-miniprogram/*/index',
  },
]

Page({
  data: {
    cards,
  },
  onOpenCard(event: WechatMiniprogram.BaseEvent<{ route?: string }>) {
    const route = event.currentTarget.dataset.route
    if (typeof route !== 'string' || !route) {
      return
    }

    void wx.navigateTo({ url: route })
  },
})
