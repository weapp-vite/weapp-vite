import type { RuntimeInstance } from 'wevu'
import { defineComponent, onAddToFavorites, onSaveExitState, onShareAppMessage, onShareTimeline, ref } from 'wevu'

defineComponent({
  features: {
    enableOnShareAppMessage: true,
    enableOnShareTimeline: true,
    enableOnAddToFavorites: true,
    enableOnSaveExitState: true,
  },
  setup(_props: Record<string, never>, { runtime }: { runtime: RuntimeInstance<any, any, any> }) {
    const shareTitle = ref('wevu runtime 分享示例')
    const sharePath = ref('/pages/share/index')
    const savedAt = ref<string>('')

    function syncShareFields() {
      runtime.state.shareTitle = shareTitle.value
      runtime.state.sharePath = sharePath.value
    }
    syncShareFields()

    function onShareTitleInput(event: WechatMiniprogram.Input) {
      shareTitle.value = event.detail.value
      syncShareFields()
    }
    function onSharePathInput(event: WechatMiniprogram.Input) {
      sharePath.value = event.detail.value
      syncShareFields()
    }

    onSaveExitState(() => {
      const at = new Date().toLocaleString()
      savedAt.value = at
      return { data: { savedAt: at, shareTitle: shareTitle.value, sharePath: sharePath.value } }
    })

    onShareAppMessage(() => ({
      title: shareTitle.value || 'wevu 分享',
      path: sharePath.value || '/pages/share/index',
    }))
    onShareTimeline(() => ({
      title: shareTitle.value || 'wevu 分享到朋友圈',
    }))
    onAddToFavorites(() => ({
      title: shareTitle.value || 'wevu 收藏',
      query: sharePath.value || '/pages/share/index',
    }))

    wx.showShareMenu({
      withShareTicket: true,
      showShareItems: ['shareAppMessage', 'shareTimeline'],
    })

    return {
      savedAt,
      shareTitle,
      sharePath,
      onShareTitleInput,
      onSharePathInput,
    }
  },
})
