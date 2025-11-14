import { definePage, onAddToFavorites, onSaveExitState, onShareAppMessage, onShareTimeline, ref } from 'wevu'

const page = definePage({
  data: () => ({
    // 纯数据字段（供原生分享函数读取）
    shareTitle: 'wevu runtime 分享示例',
    sharePath: '/pages/share/index',
  }),
  setup() {
    const savedAt = ref<string>('')
    onSaveExitState(() => {
      const at = new Date().toLocaleString()
      savedAt.value = at
      return {
        savedAt: at,
      }
    })
    // wevu 风格分享钩子（单一监听）
    onShareAppMessage(() => {
      const self = (this as any) || {}
      return {
        title: self.shareTitle ?? 'wevu 分享',
        path: self.sharePath ?? '/pages/share/index',
      }
    })
    onShareTimeline(() => {
      const self = (this as any) || {}
      return {
        title: self.shareTitle ?? 'wevu 分享到朋友圈',
      }
    })
    onAddToFavorites(() => {
      const self = (this as any) || {}
      return {
        title: self.shareTitle ?? 'wevu 收藏',
        query: self.sharePath ?? '/pages/share/index',
      } as any
    })
    return {
      savedAt,
    }
  },
  // 原生分享钩子
  onShareAppMessage() {
    return {
      title: (this as any).shareTitle,
      path: (this as any).sharePath,
    }
  },
  onShareTimeline() {
    return {
      title: (this as any).shareTitle,
    }
  },
}, { enableShareAppMessage: true, enableShareTimeline: true, enableAddToFavorites: true })

page.mount()
