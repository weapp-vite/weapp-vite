import type { PageInstance } from 'miniprogram-api-typings'
import { formatTime } from '@/utils/util'

interface HomeData {
  version: string
  envPreview: string
  lastUpdated: string
  sections: Array<{ title: string, desc: string, url: string }>
}

const sections: HomeData['sections'] = [
  {
    title: '运行时能力',
    desc: '动态 import、require.async、WXS 互通',
    url: '/pages/features/runtime/index',
  },
  {
    title: 'UI & 样式',
    desc: 'Tailwind + TDesign / Vant 自动按需',
    url: '/pages/features/ui/index',
  },
  {
    title: '构建 & 配置',
    desc: '分包策略、auto-import、worker、配置展示',
    url: '/pages/features/build/index',
  },
  {
    title: '分包场景',
    desc: '跨分包共享 chunk、独立分包示例',
    url: '/pages/subpackages/demo',
  },
]

Page<HomeData>({
  data: {
    version: '',
    envPreview: '',
    lastUpdated: formatTime(new Date()),
    sections,
  },

  onLoad() {
    const pkg = require('../../package.json')
    this.setData({
      version: pkg.version || '',
      envPreview: JSON.stringify(import.meta.env, null, 2),
    })
  },

  handleNavigate(event: WechatMiniprogram.TouchEvent) {
    const { url } = event.currentTarget.dataset as { url?: string }
    if (!url) {
      return
    }
    wx.navigateTo({ url })
  },

  handleCopyEnv(this: PageInstance<HomeData>) {
    wx.setClipboardData({
      data: this.data.envPreview,
      success: () => {
        wx.showToast({ title: '已复制 env', icon: 'none' })
      },
    })
  },
})
