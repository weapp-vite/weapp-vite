import ActionSheet, { ActionSheetTheme } from 'tdesign-miniprogram/action-sheet/index'
import { hello } from '@/utils/util'

const firstGrid = [
  {
    label: '微信',
    image: 'https://tdesign.gtimg.com/mobile/demos/wechat.png',
  },
  {
    label: '朋友圈',
    image: 'https://tdesign.gtimg.com/mobile/demos/times.png',
  },
  {
    label: 'QQ',
    image: 'https://tdesign.gtimg.com/mobile/demos/qq.png',
  },
  {
    label: '企业微信',
    image: 'https://tdesign.gtimg.com/mobile/demos/wecom.png',
  },
  {
    label: '收藏',
    icon: 'star',
  },
  {
    label: '刷新',
    icon: 'refresh',
  },
  {
    label: '下载',
    icon: 'download',
  },
  {
    label: '复制',
    icon: 'queue',
  },
]
Page({
  data: {
    mode: 'light',
    hello: {
      title: 'Hello weapp-vite + TDesign',
      description: '集成 TDesign Miniprogram 与 Tailwind CSS，帮助你快速搭建企业级交互界面。',
      docs: 'https://vite.icebreaker.top',
      links: [
        {
          text: '复制文档链接',
          url: 'https://vite.icebreaker.top',
        },
        {
          text: 'TDesign 小程序组件',
          url: 'https://tdesign.tencent.com/miniprogram/overview',
          variant: 'ghost',
        },
      ],
    },
  },
  switchMode() {
    if (this.data.mode === 'light') {
      this.setData({
        mode: 'dark',
      })
    }
    else {
      this.setData({
        mode: 'light',
      })
    }
  },
  async copy(e: WechatMiniprogram.BaseEvent) {
    if (e.mark?.url) {
      await wx.setClipboardData({
        data: e.mark.url,
      })
      console.log(`复制成功: ${e.mark.url}`)
    }
  },
  handleSelected(e: WechatMiniprogram.CustomEvent) {
    console.log(e.detail)
  },
  onLoad() {
    console.log(hello())
  },
  handleAction() {
    ActionSheet.show({
      theme: ActionSheetTheme.Grid,
      selector: '#t-action-sheet',
      context: this,
      items: firstGrid,
      align: 'center',
      description: '',
    })
  },
})
