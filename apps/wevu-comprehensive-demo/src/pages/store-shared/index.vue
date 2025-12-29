<script lang="ts">
import { storeToRefs } from 'wevu'
import {
  useCounterStore,
  usePluginDemoStore,
  useTodoStore,
} from '../../stores/storeDemo'

export default {
  setup() {
    // 复用同一份 counter store
    const counterStore = useCounterStore()
    const { count, doubleCount, displayName } = storeToRefs(counterStore)
    const { increment, decrement, reset, setValue } = counterStore

    // 复用 todo store
    const todoStore = useTodoStore()
    const { summary: todoSummary, visibleItems: visibleTodos } = storeToRefs(todoStore)
    const { toggle, completeAll } = todoStore

    // 复用插件增强的 store
    const pluginStore = usePluginDemoStore()
    const { statusText, requestCount } = storeToRefs(pluginStore)

    async function runPluginTask() {
      await pluginStore.runAsyncTask()
    }

    function failPluginTask() {
      try {
        pluginStore.failOnce()
      }
      catch (error) {
        console.error('[Plugin Demo Shared] failOnce', error)
      }
    }

    function resetSharedState() {
      reset()
      todoStore.$reset()
      pluginStore.clearStatus()
    }

    function setCounterPreset() {
      setValue(99)
    }

    function onToggleTodo(id: number) {
      toggle(id)
    }

    return {
      // counter
      count,
      doubleCount,
      displayName,
      increment,
      decrement,
      reset,
      setCounterPreset,

      // todo
      todoSummary,
      visibleTodos,
      onToggleTodo,
      completeAllTodos: completeAll,

      // plugin
      pluginStatusText: statusText,
      pluginRequestCount: requestCount,
      runPluginTask,
      failPluginTask,
      resetSharedState,
    }
  },
}
</script>

<template>
  <view class="container">
    <view class="page-title">
      Store 跨页面共享
    </view>
    <view class="note">
      本页与「状态管理」页面共用同一 store：切换页面后，计数、待办和插件状态都会保持同步。
    </view>

    <view class="section">
      <view class="section-title">
        计数器 (共享)
      </view>
      <view class="demo-item">
        <view>
          <text class="label">
            Count: {{ count }}
          </text>
          <view class="sub-text">
            Double: {{ doubleCount }}
          </view>
          <view class="sub-text">
            Display: {{ displayName }}
          </view>
        </view>
        <view class="buttons">
          <button class="btn btn-small" @click="decrement">
            -
          </button>
          <button class="btn btn-small btn-primary" @click="increment">
            +
          </button>
        </view>
      </view>
      <view class="demo-item">
        <button class="btn btn-secondary" @click="setCounterPreset">
          设置为 99
        </button>
        <button class="btn btn-secondary" @click="reset">
          Reset
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        待办列表 (共享)
      </view>
      <view class="demo-item">
        <view>
          <text class="label">
            完成度: {{ todoSummary }}
          </text>
          <view class="sub-text">
            直接在此切换后，回到「状态管理」页会同步显示
          </view>
        </view>
        <view class="buttons">
          <button class="btn btn-small btn-primary" @click="completeAllTodos">
            全部完成
          </button>
        </view>
      </view>
      <view class="todo-row" wx:for="{{ visibleTodos }}" wx:key="id" wx:for-item="todo">
        <view class="todo-title {{ todo.done ? 'done' : '' }}">
          {{ todo.title }}
        </view>
        <button class="btn btn-small" @click="onToggleTodo(todo.id)">
          {{ todo.done ? '恢复' : '完成' }}
        </button>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        插件状态 (共享)
      </view>
      <view class="demo-item">
        <view>
          <text class="label">
            状态: {{ pluginStatusText }}
          </text>
          <view class="sub-text">
            调用次数: {{ pluginRequestCount }}
          </view>
        </view>
        <view class="buttons">
          <button class="btn btn-small btn-primary" @click="runPluginTask">
            执行异步任务
          </button>
          <button class="btn btn-small btn-secondary" @click="failPluginTask">
            触发错误
          </button>
        </view>
      </view>
      <view class="demo-item">
        <button class="btn btn-secondary" @click="resetSharedState">
          重置共享状态
        </button>
      </view>
      <view class="tip-inline">
        <text>插件日志依旧记录在「状态管理」页面，可来回切换查看。</text>
      </view>
    </view>
  </view>
</template>

<style>
/* stylelint-disable order/properties-order */
.container {
  padding: 32rpx;
}

.page-title {
  font-size: 44rpx;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 20rpx;
}

.note {
  padding: 20rpx;
  margin-bottom: 28rpx;
  background: #f0f7ff;
  color: #406599;
  border-radius: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
}

.section {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 2rpx 12rpx rgb(0 0 0 / 8%);
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
  padding-bottom: 12rpx;
  border-bottom: 2rpx solid #e0e0e0;
}

.demo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #eee;
}

.demo-item:last-child {
  border-bottom: none;
}

.label {
  font-size: 28rpx;
  color: #333;
}

.sub-text {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #888;
}

.buttons {
  display: flex;
  gap: 12rpx;
}

.btn {
  padding: 16rpx 22rpx;
  border-radius: 10rpx;
  font-size: 26rpx;
}

.btn-small {
  min-width: 80rpx;
  padding: 8rpx 24rpx;
  font-size: 24rpx;
}

.btn-primary {
  background-color: #07c160;
  color: #fff;
}

.btn-secondary {
  background-color: #10aeff;
  color: #fff;
}

.todo-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16rpx 0;
  border-top: 1rpx solid #f0f0f0;
}

.todo-title {
  font-size: 28rpx;
  color: #333;
}

.todo-title.done {
  color: #9aa0a6;
  text-decoration: line-through;
}

.tip-inline {
  margin-top: 16rpx;
  padding: 12rpx 14rpx;
  font-size: 24rpx;
  color: #577399;
  background: #f0f7ff;
  border-radius: 10rpx;
}
/* stylelint-enable order/properties-order */
</style>

<config lang="json">
{
  "navigationBarTitleText": "Store 跨页面"
}
</config>
