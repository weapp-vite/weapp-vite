import {
  callHookList,
  defineComponent,
  getCurrentInstance,
  onActivated,
  onAddToFavorites,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onHide,
  onMounted,
  onPageScroll,
  onReady,
  onRouteDone,
  onSaveExitState,
  onServerPrefetch,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onUnload,
  onUnmounted,
  onUpdated,
  ref,
} from 'wevu'

import { clearLifecycleLogs, lifecycleLogs, pushLifecycleLog } from '../../stores/lifecycle'

defineComponent({
  methods: {
    triggerUpdate() {},
    simulateTabTap() {},
    simulateRouteDone() {},
    triggerAppError() {},
    toggleShareMenu() {},
    resetLogs() {},
    onShareTitleInput(_event: WechatMiniprogram.Input) {},
    onSharePathInput(_event: WechatMiniprogram.Input) {},
    onFavoriteQueryInput(_event: WechatMiniprogram.Input) {},
  },
  setup() {
    const instance = getCurrentInstance()
    const shareTitle = ref('wevu runtime 全生命周期')
    const sharePath = ref('/pages/wevu-hooks/index')
    const favoritesQuery = ref('ref=wevu-hooks')
    const savedAt = ref('')
    const scrollTop = ref(0)
    const updateCount = ref(0)
    const readyAt = ref('')
    const logs = lifecycleLogs

    const addLog = (
      hook: string,
      detail?: string,
      scope: 'app' | 'page' | 'component' | 'alias' = 'page',
    ) => {
      pushLifecycleLog(hook, scope, detail)
    }

    onBeforeMount(() => addLog('onBeforeMount', 'setup 同步触发', 'alias'))
    onMounted(() => {
      readyAt.value = new Date().toLocaleTimeString()
      addLog('onMounted', '等价 onReady（组件语义）', 'alias')
    })
    onReady(() => addLog('onReady', '首屏渲染完成'))
    onShow(() => addLog('onShow', '页面显示'))
    onHide(() => addLog('onHide', '页面隐藏'))
    onUnload(() => addLog('onUnload', '页面卸载'))
    onUnmounted(() => addLog('onUnmounted', '卸载完成', 'alias'))
    onBeforeUnmount(() => addLog('onBeforeUnmount', 'setup 同步调用', 'alias'))
    onActivated(() => addLog('onActivated', '等价 onShow', 'alias'))
    onDeactivated(() => addLog('onDeactivated', '等价 onHide', 'alias'))

    onBeforeUpdate(() => addLog('onBeforeUpdate', `第 ${updateCount.value + 1} 次更新前`, 'alias'))
    onUpdated(() => addLog('onUpdated', `第 ${updateCount.value} 次更新后`, 'alias'))

    onPageScroll((event: any) => {
      const top = Number((event && (event.scrollTop ?? 0)) || 0)
      scrollTop.value = top
      addLog('onPageScroll', `scrollTop: ${top}`)
    })

    onRouteDone(opt => addLog('onRouteDone', JSON.stringify(opt ?? {}), 'component'))
    onTabItemTap(opt => addLog('onTabItemTap', JSON.stringify(opt ?? {}), 'component'))

    onSaveExitState(() => {
      const at = new Date().toLocaleString()
      savedAt.value = at
      addLog('onSaveExitState', `保存退出状态：${at}`)
      return { data: { savedAt: at, shareTitle: shareTitle.value, sharePath: sharePath.value } }
    })

    onShareAppMessage(() => {
      addLog('onShareAppMessage', '分享卡片由 setup 返回')
      return {
        title: shareTitle.value || 'wevu runtime',
        path: sharePath.value || '/pages/wevu-hooks/index',
      }
    })
    onShareTimeline(() => {
      addLog('onShareTimeline', '朋友圈分享内容')
      return {
        title: shareTitle.value || 'wevu timeline',
      }
    })
    onAddToFavorites(() => {
      addLog('onAddToFavorites', '添加到收藏')
      return {
        title: shareTitle.value || 'wevu 收藏',
        query: favoritesQuery.value || 'ref=wevu-hooks',
      }
    })

    onServerPrefetch(() => {})
    addLog('onServerPrefetch', '小程序中为占位 API', 'alias')

    wx.showShareMenu({
      withShareTicket: true,
      showShareItems: ['shareAppMessage', 'shareTimeline'],
    })

    function triggerUpdate() {
      updateCount.value += 1
      addLog('state-change', `触发 setData #${updateCount.value}`)
    }

    function simulateTabTap() {
      addLog('simulate', '手动触发 onTabItemTap', 'component')
      if (instance) {
        callHookList(instance as any, 'onTabItemTap', [{ pagePath: '/pages/wevu-hooks/index', text: 'manual' }])
      }
    }

    function simulateRouteDone() {
      addLog('simulate', '手动触发 onRouteDone', 'component')
      if (instance) {
        callHookList(instance as any, 'onRouteDone', [{ from: 'manual', at: Date.now() }])
      }
    }

    function triggerAppError() {
      const app = typeof getApp === 'function' ? getApp() : undefined
      if (app && typeof (app as any).onError === 'function') {
        const error = new Error('来自 wevu 生命周期示例的错误')
        ;(app as any).onError(error)
      }
      else {
        addLog('onAppError', 'getApp() 暂不可用', 'app')
      }
    }

    function toggleShareMenu() {
      wx.showShareMenu({
        withShareTicket: true,
        showShareItems: ['shareAppMessage', 'shareTimeline'],
      })
      addLog('share-menu', '已调用 wx.showShareMenu', 'page')
    }

    function resetLogs() {
      clearLifecycleLogs()
      addLog('logs', '日志已清空', 'page')
    }

    function onShareTitleInput(event: WechatMiniprogram.Input) {
      shareTitle.value = event?.detail?.value ?? ''
    }

    function onSharePathInput(event: WechatMiniprogram.Input) {
      sharePath.value = event?.detail?.value ?? ''
    }

    function onFavoriteQueryInput(event: WechatMiniprogram.Input) {
      favoritesQuery.value = event?.detail?.value ?? ''
    }

    return {
      logs,
      scrollTop,
      readyAt,
      shareTitle,
      sharePath,
      favoritesQuery,
      savedAt,
      updateCount,
      triggerUpdate,
      simulateTabTap,
      simulateRouteDone,
      triggerAppError,
      toggleShareMenu,
      resetLogs,
      onShareTitleInput,
      onSharePathInput,
      onFavoriteQueryInput,
    }
  },
})
