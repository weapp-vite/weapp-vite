<script lang="ts">
import { defineComponent, ref } from 'wevu'

function formatTime() {
  const now = new Date()
  return now.toLocaleTimeString()
}

export default defineComponent({
  behaviors: ['wx://component-export'],
  setup(_props, { instance, expose }) {
    const logs = ref<string[]>([])
    const setDataCallCount = ref(0)
    const lastSetDataKeys = ref<string[]>([])

    const rawSetData = (instance as any)?.setData
    if (typeof rawSetData === 'function') {
      ;(instance as any).setData = function wrappedSetData(payload: any, cb: any) {
        setDataCallCount.value += 1
        lastSetDataKeys.value = Object.keys(payload ?? {})
        logs.value.push(`[${formatTime()}] setData#${setDataCallCount.value}: ${lastSetDataKeys.value.join(', ') || '(empty)'}`)
        return rawSetData.call(this, payload, cb)
      }
    }

    logs.value.push(`[${formatTime()}] setup(): executed in lifetimes.created`)

    const count = ref(1)
    // 触发一次更新：会在 created 阶段被 wevu 缓冲，并在 attached/onLoad 时机 flush
    Promise.resolve().then(() => {
      count.value += 1
      logs.value.push(`[${formatTime()}] microtask: count++ (setData should still be deferred before attached)`)
    })

    function pushLog(message: string) {
      logs.value.push(`[${formatTime()}] ${message}`)
    }

    function increment() {
      count.value += 1
      pushLog(`button: count -> ${count.value}`)
    }

    expose({
      exposedFlag: true,
      a: 1,
      getSetDataCallCount: () => setDataCallCount.value,
      ping: () => 'pong(from expose)',
    })

    return {
      logs,
      setDataCallCount,
      lastSetDataKeys,
      count,
      increment,
      pushLog,
    }
  },
  export() {
    // 用于演示：当同时提供 export() 与 setup.expose() 时，会浅合并；export() 优先级更高
    return {
      fromExport: true,
      a: 0,
      ping: () => 'pong(from export)',
    }
  },
  lifetimes: {
    created() {
      this.pushLog?.(`lifetimes.created: setDataCallCount=${this.setDataCallCount}`)
    },
    attached() {
      this.pushLog?.(`lifetimes.attached: setDataCallCount=${this.setDataCallCount} (after flush)`)
    },
    ready() {
      this.pushLog?.(`lifetimes.ready: setDataCallCount=${this.setDataCallCount}`)
    },
  },
})
</script>

<template>
  <view class="demo">
    <view class="header">
      <text class="title">
        setup@created + setData 延迟 flush
      </text>
      <text class="desc">
        setup 在 lifetimes.created 执行；created 阶段的 setData 会被 wevu 缓冲，直到 attached/onLoad 才 flush。
      </text>
    </view>

    <view class="stats">
      <view class="stat">
        <text class="label">
          count
        </text>
        <text class="value">
          {{ count }}
        </text>
      </view>
      <view class="stat">
        <text class="label">
          setData 次数
        </text>
        <text class="value">
          {{ setDataCallCount }}
        </text>
      </view>
    </view>

    <view class="actions">
      <button class="btn btn-primary" @click="increment">
        count +1
      </button>
    </view>

    <view class="section">
      <view class="section-title">
        最近一次 setData keys
      </view>
      <text class="mono">
        {{ lastSetDataKeys.length ? lastSetDataKeys.join(', ') : '(none)' }}
      </text>
    </view>

    <view class="section">
      <view class="section-title">
        日志
      </view>
      <view class="logs">
        <view v-for="(item0, index0) in logs" :key="`${index0}-${item0}`" class="log">
          <text class="log-text">
            {{ item0 }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.demo {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 12rpx rgb(0 0 0 / 8%);
}

.header {
  margin-bottom: 20rpx;
}

.title {
  display: block;
  font-size: 32rpx;
  font-weight: 700;
  color: #111827;
  margin-bottom: 10rpx;
}

.desc {
  display: block;
  font-size: 24rpx;
  color: #6b7280;
  line-height: 1.5;
}

.stats {
  display: flex;
  gap: 16rpx;
  margin-bottom: 16rpx;
}

.stat {
  flex: 1;
  padding: 18rpx;
  background: #f8fafc;
  border-radius: 12rpx;
}

.label {
  display: block;
  font-size: 22rpx;
  color: #6b7280;
  margin-bottom: 6rpx;
}

.value {
  display: block;
  font-size: 36rpx;
  font-weight: 700;
  color: #111827;
}

.actions {
  display: flex;
  justify-content: flex-start;
  margin-bottom: 20rpx;
}

.section {
  padding-top: 14rpx;
  border-top: 1rpx solid #eef2f7;
  margin-top: 14rpx;
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #374151;
  margin-bottom: 10rpx;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 24rpx;
  color: #111827;
}

.logs {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.log {
  padding: 12rpx;
  background: #f3f4f6;
  border-radius: 10rpx;
}

.log-text {
  font-size: 22rpx;
  color: #374151;
  line-height: 1.5;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "$schema": "https://vite.icebreaker.top/component.json",
  "component": true,
  "styleIsolation": "apply-shared"
}
</config>
