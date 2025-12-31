<script lang="ts">
import {
  callHookList,
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

import { clearLifecycleLogs, lifecycleLogs, pushLifecycleLog } from '../../stores/lifecycleLogs'

export default {
  setup() {
    const instance = getCurrentInstance()
    const shareTitle = ref('wevu 生命周期示例')
    const sharePath = ref('/pages/wevu-hooks/index')
    const favoritesQuery = ref('ref=wevu-hooks')
    const savedAt = ref('')
    const scrollTop = ref(0)
    const updateCount = ref(0)
    const readyAt = ref('')
    const logs = lifecycleLogs

    const addLog = (
      hook: string,
      detail: string | undefined,
      scope: 'app' | 'page' | 'component' | 'alias' = 'page',
    ) => {
      console.log(`[wevu-hooks] ${scope}:${hook}`, detail ?? '')
      pushLifecycleLog(hook, scope, detail)
    }

    onBeforeMount(() => addLog('onBeforeMount', 'setup 同步触发', 'alias'))
    onMounted(() => {
      readyAt.value = new Date().toLocaleTimeString()
      addLog('onMounted', '等价 onReady（组件语义）', 'alias')
    })
    onReady(() => addLog('onReady', '页面首屏渲染完成'))
    onShow(() => addLog('onShow', '页面显示'))
    onHide(() => addLog('onHide', '页面隐藏'))
    onUnload(() => addLog('onUnload', '页面卸载'))
    onUnmounted(() => addLog('onUnmounted', '卸载结束', 'alias'))
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
      return {
        savedAt: at,
        shareTitle: shareTitle.value,
        sharePath: sharePath.value,
      }
    })

    onShareAppMessage(() => {
      addLog('onShareAppMessage', '分享卡片由 setup 返回')
      return {
        title: shareTitle.value || 'wevu 分享',
        path: sharePath.value || '/pages/wevu-hooks/index',
      }
    })
    onShareTimeline(() => {
      addLog('onShareTimeline', '朋友圈分享内容')
      return {
        title: shareTitle.value || 'wevu 分享到朋友圈',
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
      console.log('[wevu-hooks] action:triggerUpdate')
      updateCount.value += 1
      addLog('state-change', `触发 setData #${updateCount.value}`)
    }

    function simulateTabTap() {
      console.log('[wevu-hooks] action:simulateTabTap')
      addLog('simulate', '手动触发 onTabItemTap', 'component')
      if (instance) {
        callHookList(instance as any, 'onTabItemTap', [{ pagePath: '/pages/wevu-hooks/index', text: 'manual' }])
      }
    }

    function simulateRouteDone() {
      console.log('[wevu-hooks] action:simulateRouteDone')
      addLog('simulate', '手动触发 onRouteDone', 'component')
      if (instance) {
        callHookList(instance as any, 'onRouteDone', [{ from: 'manual', at: Date.now() }])
      }
    }

    function triggerAppError() {
      console.log('[wevu-hooks] action:triggerAppError')
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
      console.log('[wevu-hooks] action:toggleShareMenu')
      wx.showShareMenu({
        withShareTicket: true,
        showShareItems: ['shareAppMessage', 'shareTimeline'],
      })
      addLog('share-menu', '已调用 wx.showShareMenu', 'page')
    }

    function resetLogs() {
      console.log('[wevu-hooks] action:resetLogs')
      clearLifecycleLogs()
      addLog('logs', '日志已清空', 'page')
    }

    function onShareTitleInput(event: any) {
      console.log('[wevu-hooks] input:shareTitle', event?.detail?.value ?? '')
      shareTitle.value = event?.detail?.value ?? ''
    }

    function onSharePathInput(event: any) {
      console.log('[wevu-hooks] input:sharePath', event?.detail?.value ?? '')
      sharePath.value = event?.detail?.value ?? ''
    }

    function onFavoriteQueryInput(event: any) {
      console.log('[wevu-hooks] input:favoritesQuery', event?.detail?.value ?? '')
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
  methods: {
    onPageScroll(event: any) {
      const top = Number((event && (event.scrollTop ?? 0)) || 0)
      console.log('[wevu-hooks] options:onPageScroll', top)
      this.scrollTop = top
    },
  },
  onShareAppMessage() {
    console.log('[wevu-hooks] options:onShareAppMessage', { title: this.shareTitle, path: this.sharePath })
    return {
      title: this.shareTitle,
      path: this.sharePath,
    }
  },
  onShareTimeline() {
    console.log('[wevu-hooks] options:onShareTimeline', { title: `${this.shareTitle} (Timeline)` })
    return {
      title: `${this.shareTitle} (Timeline)`,
    }
  },
  onAddToFavorites() {
    console.log('[wevu-hooks] options:onAddToFavorites', { title: this.shareTitle, query: this.favoritesQuery })
    return {
      title: this.shareTitle,
      query: this.favoritesQuery,
    }
  },
}
</script>

<template>
  <view class="container lifecycle-page">
    <view class="page-title">
      全生命周期 onXXX
    </view>

    <view class="section">
      <view class="section-title">
        状态概览
      </view>
      <view class="stats">
        <view class="stat-item">
          <text class="stat-label">
            已触发更新
          </text>
          <text class="stat-value">
            {{ updateCount }}
          </text>
        </view>
        <view class="stat-item">
          <text class="stat-label">
            最新滚动
          </text>
          <text class="stat-value">
            {{ scrollTop }} px
          </text>
        </view>
      </view>
      <view class="meta-row">
        <text class="meta">
          ready: {{ readyAt || '待触发' }}
        </text>
        <text class="meta">
          saveExitState: {{ savedAt || '暂无' }}
        </text>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        分享 / 收藏配置
      </view>
      <view class="field">
        <text class="field-label">
          分享标题
        </text>
        <input
          class="field-input"
          value="{{shareTitle}}"
          placeholder="wevu 生命周期示例"
          bindinput="onShareTitleInput"
        >
      </view>
      <view class="field">
        <text class="field-label">
          分享路径
        </text>
        <input
          class="field-input"
          value="{{sharePath}}"
          placeholder="/pages/wevu-hooks/index"
          bindinput="onSharePathInput"
        >
      </view>
      <view class="field">
        <text class="field-label">
          收藏 query
        </text>
        <input
          class="field-input"
          value="{{favoritesQuery}}"
          placeholder="ref=wevu-hooks"
          bindinput="onFavoriteQueryInput"
        >
      </view>
      <view class="hint">
        onShareAppMessage / onShareTimeline / onAddToFavorites 均会读取这些值
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        操作面板
      </view>
      <view class="actions">
        <button class="btn btn-primary" @click="triggerUpdate">
          触发 setData 更新
        </button>
        <button class="btn btn-info" @click="simulateTabTap">
          模拟 onTabItemTap
        </button>
        <button class="btn btn-info" @click="simulateRouteDone">
          模拟 onRouteDone
        </button>
        <button class="btn btn-warning" @click="triggerAppError">
          触发 onAppError/onErrorCaptured
        </button>
        <button class="btn btn-success" @click="toggleShareMenu">
          展示分享/收藏入口
        </button>
        <button class="btn btn-secondary" @click="resetLogs">
          清空日志
        </button>
      </view>
      <view class="hint">
        向下滚动页面可触发 onPageScroll，返回上一页可触发 onHide/onUnload/onDeactivated/onUnmounted
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        生命周期日志（{{ logs.length }}）
      </view>
      <scroll-view scroll-y class="log-list">
        <block v-if="logs.length">
          <view v-for="(item, index) in logs" :key="index" class="log-item">
            <text>{{ item }}</text>
          </view>
        </block>
        <block v-else>
          <view class="empty">
            等待触发生命周期…
          </view>
        </block>
      </scroll-view>
    </view>

    <view class="info-box">
      <view class="info-title">
        覆盖的 onXXX 钩子
      </view>
      <view class="info-grid">
        <view class="info-col">
          <text class="hook">
            App: onAppShow / onAppHide / onAppError
          </text>
          <text class="hook">
            Alias: onErrorCaptured / onMounted / onBeforeMount / onBeforeUnmount / onUnmounted
          </text>
        </view>
        <view class="info-col">
          <text class="hook">
            页面: onShow / onHide / onReady / onUnload / onPageScroll / onSaveExitState
          </text>
          <text class="hook">
            组件: onRouteDone / onTabItemTap / onActivated / onDeactivated
          </text>
          <text class="hook">
            分享: onShareAppMessage / onShareTimeline / onAddToFavorites
          </text>
          <text class="hook">
            更新: onBeforeUpdate / onUpdated / onServerPrefetch
          </text>
        </view>
      </view>
    </view>

    <view class="spacer" />
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.lifecycle-page .stats {
  display: flex;
  gap: 24rpx;
}

.lifecycle-page .stat-item {
  flex: 1;
  padding: 28rpx;
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border-radius: 12rpx;
  color: #fff;
}

.lifecycle-page .stat-label {
  display: block;
  font-size: 24rpx;
  opacity: 0.8;
  margin-bottom: 8rpx;
}

.lifecycle-page .stat-value {
  display: block;
  font-size: 42rpx;
  font-weight: 700;
}

.meta-row {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
  color: #666;
  font-size: 24rpx;
}

.field {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
}

.field-label {
  width: 180rpx;
  font-size: 26rpx;
  color: #333;
}

.field-input {
  flex: 1;
  padding: 16rpx 20rpx;
  border: 1rpx solid #e5e7eb;
  border-radius: 12rpx;
  background: #fafafa;
  font-size: 26rpx;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.btn {
  flex: 1 1 46%;
}

.btn-secondary {
  background: #e5e7eb;
  color: #111827;
}

.hint {
  margin-top: 12rpx;
  color: #6b7280;
  font-size: 24rpx;
}

.log-list {
  max-height: 520rpx;
  padding: 12rpx;
  background: #f8fafc;
  border-radius: 12rpx;
}

.log-item {
  padding: 16rpx;
  border-radius: 10rpx;
  background: #fff;
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #1f2937;
  box-shadow: 0 4rpx 12rpx rgb(0 0 0 / 6%);
}

.info-box {
  margin-top: 24rpx;
  padding: 20rpx;
  background: #eef2ff;
  border-radius: 12rpx;
  border-left: 4rpx solid #6366f1;
}

.info-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #4338ca;
  margin-bottom: 12rpx;
}

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.hook {
  display: block;
  font-size: 26rpx;
  color: #312e81;
  line-height: 1.5;
}

.empty {
  text-align: center;
  color: #9ca3af;
  padding: 24rpx 0;
}

.spacer {
  height: 160rpx;
}
/* stylelint-enable order/properties-order */
</style>

<json>
{
  "navigationBarTitleText": "全生命周期 onXXX",
  "navigationBarBackgroundColor": "#111827",
  "navigationBarTextStyle": "white"
}
</json>
