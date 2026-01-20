import {
  isMiniProgram,
  isWeb,
  platform,
  platformBadge,
  platformBanner,
  platformClass,
  platformCta,
  platformDocLink,
  platformDocsLabel,
  platformDisplayName,
  platformFeature,
  platformExamples,
  platformWrapperAccent,
} from '../../utils/platform'

if (import.meta.env.IS_WEB) {
  console.info('[demo] 当前执行 Web 端专属代码分支')
}
if (import.meta.env.IS_MINIPROGRAM) {
  console.info('[demo] 当前执行小程序端专属代码分支')
}

const helloLinks = [
  {
    text: '复制文档链接',
    url: 'https://vite.icebreaker.top',
  },
  {
    text: 'GitHub 仓库',
    url: 'https://github.com/weapp-vite/weapp-vite',
    variant: 'ghost' as const,
  },
  isWeb
    ? {
        text: 'Web 运行时调试指南',
        url: 'https://vite.icebreaker.top/guide/web.html#运行时',
        variant: 'ghost' as const,
      }
    : {
        text: '微信开发者工具指南',
        url: 'https://developers.weixin.qq.com/miniprogram/dev/devtools/devtools.html',
        variant: 'ghost' as const,
      },
]

if (platformDocLink) {
  helloLinks.push({
    text: `${platformDisplayName} 官方文档`,
    url: platformDocLink,
    variant: 'ghost' as const,
  })
}

Page({
  data: {
    hello: {
      title: 'Hello weapp-vite',
      description: '这是最基础的 weapp-vite 模板，包含快速开发所需的构建与热更新能力。',
      docs: 'https://vite.icebreaker.top',
      links: helloLinks,
    },
    platform,
    platformBadge,
    isWeb,
    isMiniProgram,
    platformBanner,
    platformClass,
    platformWrapperAccent,
    platformFeature,
    platformCta,
    platformDisplayName,
    platformDocLink,
    platformDocsLabel,
    platformExamples,
  },
  onClick() {
    console.log('on click')
  },
  gotoAbout() {
    if (typeof wx !== 'undefined' && typeof wx.navigateTo === 'function') {
      void wx.navigateTo({
        url: 'pages/about/index?from=index',
      })
    }
  },
  gotoInteractive() {
    if (typeof wx !== 'undefined' && typeof wx.navigateTo === 'function') {
      void wx.navigateTo({
        url: 'pages/interactive/index?from=index',
      })
    }
  },
  openPlatformDocs() {
    const { platformDocLink: url } = this.data as { platformDocLink?: string }
    if (!url) {
      return
    }
    if (import.meta.env.IS_WEB && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener')
      return
    }
    if (typeof wx !== 'undefined') {
      const wxAny = wx as Record<string, any>
      if (typeof wxAny.openUrl === 'function') {
        wxAny.openUrl({ url })
        return
      }
      if (typeof wx.setClipboardData === 'function') {
        wx.setClipboardData({
          data: url,
          success() {
            if (typeof wx.showToast === 'function') {
              wx.showToast({
                title: '链接已复制',
                icon: 'success',
                duration: 1500,
              })
            }
          },
        })
      }
    }
  },
})
