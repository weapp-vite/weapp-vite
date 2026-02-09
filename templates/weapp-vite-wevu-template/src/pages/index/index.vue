<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

interface NavbarActionPayload {
  type: 'refresh' | 'more' | 'pill'
  value?: string
}

interface HelloActionPayload {
  type: 'toggle' | 'copy'
  value?: string
}

type HighlightTone = 'up' | 'down' | 'flat'

interface HighlightItem {
  key: string
  label: string
  value: string | number
  tone?: HighlightTone
  note?: string
}

definePageJson({
  navigationStyle: 'custom',
  navigationBarTitleText: '首页',
})

const count = ref(0)
const message = ref('Hello WeVU!')
const activeGroup = ref('概览')

const navPills = ref([
  '概览',
  '组件',
  '性能',
  '工程化',
])

const todos = ref([
  '自动编译 SFC 到小程序四件套',
  '自动注入 usingComponents 与组件类型提示',
  'WXML/WXSS/WXS 全链路处理与平台适配',
  '支持 @tap.catch / @tap.stop 等事件语义',
  '通过 wevu 使用 ref/computed/watch 写业务逻辑',
])

const doubled = computed(() => count.value * 2)

const navStatus = computed(() => {
  if (count.value === 0) {
    return 'offline'
  }
  if (count.value < 3) {
    return 'syncing'
  }
  return 'online'
})

const helloHighlights = computed<HighlightItem[]>(() => {
  return [
    {
      key: 'count',
      label: '当前计数',
      value: count.value,
      tone: 'up' as const,
      note: '来自 ref 状态',
    },
    {
      key: 'double',
      label: '双倍值',
      value: doubled.value,
      tone: 'flat' as const,
      note: '来自 computed',
    },
    {
      key: 'feature',
      label: '能力条目',
      value: todos.value.length,
      tone: 'flat' as const,
      note: '模板清单',
    },
    {
      key: 'title',
      label: '标题长度',
      value: message.value.length,
      tone: message.value.length > 10 ? 'up' : 'down',
      note: '来自 v-model',
    },
  ]
})

function showToast(title: string) {
  wx.showToast({
    title,
    icon: 'none',
    duration: 1200,
  })
}

function increment() {
  count.value += 1
}

function reset() {
  count.value = 0
  showToast('计数已重置')
}

function handleNavbarAction(payload: NavbarActionPayload) {
  if (payload.type === 'pill' && payload.value) {
    activeGroup.value = payload.value
    showToast(`切换分组：${payload.value}`)
    return
  }

  if (payload.type === 'refresh') {
    increment()
    showToast('已刷新示例状态')
    return
  }

  showToast('更多能力可在模板中继续扩展')
}

function handleHelloAction(payload: HelloActionPayload) {
  if (payload.type === 'copy' && payload.value) {
    wx.setClipboardData({
      data: payload.value,
    })
    return
  }

  if (payload.type === 'toggle') {
    showToast(`面板状态：${payload.value === 'true' ? '展开' : '收起'}`)
  }
}

watch(count, (newValue, oldValue) => {
  console.log(`[wevu] count changed: ${oldValue} -> ${newValue}`)
})
</script>

<template>
  <view class="page">
    <Navbar
      :title="message"
      :subtitle="`group=${activeGroup}, count=${count}, doubled=${doubled}`"
      :pills="navPills"
      :status="navStatus"
      @action="handleNavbarAction"
    >
      <template #right>
        <button class="mini-btn" @tap.stop="reset">
          重置
        </button>
      </template>
    </Navbar>

    <HelloWorld
      :title="`欢迎，${message}`"
      :subtitle="`HelloWorld 示例面板（当前分组：${activeGroup}）`"
      :highlights="helloHighlights"
      :features="todos"
      @action="handleHelloAction"
    >
      <template #footer>
        <view class="hello-footer">
          <text class="hello-footer-text">
            此区域来自父组件 slot，展示 wevu + weapp-vite 组合能力。
          </text>
        </view>
      </template>
    </HelloWorld>

    <view class="card">
      <view class="row">
        <text class="label">
          当前计数：{{ count }}
        </text>
        <text class="label">
          双倍：{{ doubled }}
        </text>
      </view>

      <view class="row actions">
        <button class="btn primary" @tap.catch="increment">
          +1
        </button>
        <button class="btn danger" @tap.stop="reset">
          重置
        </button>
      </view>

      <view class="row">
        <text class="label">
          文本双向绑定：
        </text>
      </view>
      <input v-model="message" class="input" placeholder="输入标题…">

      <view class="row">
        <text class="label">
          Checklist
        </text>
      </view>
      <view class="todo">
        <view v-for="(todo, index) in todos" :key="index" class="todo-item">
          <text>• {{ todo }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
.page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 20rpx 32rpx 64rpx;
  background: #f6f7ff;
}

.card {
  padding: 32rpx;
  margin-top: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 32rpx rgb(44 44 84 / 10%);
}

.row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.label {
  font-size: 30rpx;
  color: #1c1c3c;
}

.actions {
  margin: 24rpx 0;
}

.btn {
  flex: 1;
  line-height: 96rpx;
  color: #fff;
  border-radius: 16rpx;
}

.btn.primary {
  background: #4c6ef5;
}

.btn.danger {
  background: #f03e3e;
}

.mini-btn {
  min-width: 124rpx;
  height: 60rpx;
  padding: 0 20rpx;
  margin: 0;
  font-size: 22rpx;
  line-height: 60rpx;
  color: #4c6ef5;
  background: #fff;
  border-radius: 14rpx;
}

.mini-btn::after {
  border: 0;
}

.input {
  box-sizing: border-box;
  height: 88rpx;
  padding: 0 24rpx;
  margin: 0 0 24rpx;
  background: #fff;
  border: 2rpx solid #e9ecef;
  border-radius: 16rpx;
}

.todo-item {
  margin-bottom: 12rpx;
  font-size: 26rpx;
  color: #4f4f7a;
}

.hello-footer {
  padding: 12rpx 14rpx;
  margin-top: 16rpx;
  background: #eef2ff;
  border-radius: 12rpx;
}

.hello-footer-text {
  font-size: 22rpx;
  color: #4f5ea0;
}
</style>
