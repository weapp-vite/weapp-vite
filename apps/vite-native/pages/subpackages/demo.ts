import { describeIndependentSubpackage } from '@/subpackage-demos/independent-subpackage'
import { getCrossSharedMessage } from '@/subpackage-demos/cross-subpackage-shared'
import { formatSharedFlavor } from '@/subpackage-demos/main-and-sub-shared'

const demos = [
  {
    title: '跨分包共享模块',
    desc: 'packageA 与 packageC 共同依赖 node_modules 下的工具，观察共享 chunk 的落点',
    target: '/packageA/pages/shared-demo/index',
    packages: 'packageA、packageC',
  },
  {
    title: '主包 + 分包共享模块',
    desc: '主包页面也引入相同工具，便于触发“提升到主包 common.js”的日志',
    target: '/packageC/pages/shared-demo/index',
    packages: '主包、packageA、packageC',
  },
  {
    title: '独立分包示例',
    desc: describeIndependentSubpackage('packageB'),
    target: '/packageB/pages/independent-demo/index',
    packages: 'packageB（independent）',
  },
]

Page({
  data: {
    demos,
    mainSharedPreview: formatSharedFlavor('主包'),
    crossPreview: getCrossSharedMessage('主包'),
  },

  handleNavigate(event: WechatMiniprogram.TouchEvent) {
    const { url } = event.currentTarget.dataset as { url?: string }
    if (!url) {
      return
    }
    wx.navigateTo({ url })
  },
})
