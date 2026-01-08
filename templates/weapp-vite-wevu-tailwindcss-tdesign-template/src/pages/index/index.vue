<script setup lang="ts">
import Dialog from 'tdesign-miniprogram/dialog/index'
import Toast from 'tdesign-miniprogram/toast/index'

import { computed, getCurrentInstance, ref, watch } from 'wevu'

import HelloWorld from '@/components/HelloWorld/index.vue'

definePageJson({
  navigationBarTitleText: '首页',
})

const mpContext = getCurrentInstance()

const count = ref(0)
const message = ref('Hello WeVU!')
const subtitle = ref('')
const todos = ref([
  '用 Vue SFC 写页面/组件',
  '用 wevu API（ref/computed/watch）写逻辑',
  '用 v-for / v-if / @tap / v-model 写模板',
])
const checkedTodos = ref<Array<string | number>>([])
const newTodo = ref('')

const doubled = computed(() => count.value * 2)
const todoOptions = computed(() =>
  todos.value.map((todo, index) => ({
    label: todo,
    value: index,
  })),
)
const checkedCount = computed(() => checkedTodos.value.length)
const completionRate = computed(() => {
  const total = Math.max(todos.value.length, 1)
  return Math.round((checkedCount.value / total) * 100)
})
const kpis = computed(() => [
  {
    key: 'counter',
    label: '计数器',
    value: count.value,
    unit: '次',
    delta: count.value - 3,
    footnote: '点击 +1 或重置',
  },
  {
    key: 'completion',
    label: '完成率',
    value: completionRate.value,
    unit: '%',
    delta: completionRate.value - 60,
    footnote: '勾选待办变化',
  },
  {
    key: 'todos',
    label: '待办总数',
    value: todos.value.length,
    unit: '条',
    delta: todos.value.length - 3,
    footnote: '新增待办变化',
  },
  {
    key: 'title',
    label: '标题长度',
    value: message.value.length,
    unit: '字',
    delta: message.value.length - 8,
    footnote: '输入标题变化',
  },
])

watch(
  count,
  () => {
    subtitle.value = `count=${count.value}, doubled=${doubled.value}`
  },
  { immediate: true },
)

function showToast(options: Parameters<typeof Toast>[0]) {
  if (!mpContext) {
    return
  }
  Toast({
    selector: '#t-toast',
    ...options,
    context: mpContext as any,
  })
}

function increment() {
  count.value += 1
  showToast({
    theme: 'success',
    message: `+1，当前：${count.value}`,
    duration: 1200,
  })
}

async function reset() {
  if (!mpContext) {
    count.value = 0
    return
  }

  try {
    await Dialog.confirm({
      context: mpContext as any,
      selector: '#t-dialog',
      title: '重置计数器',
      content: `当前计数为 ${count.value}，确定要重置吗？`,
      confirmBtn: '重置',
      cancelBtn: '取消',
    })
    count.value = 0
    showToast({ theme: 'success', message: '已重置', duration: 1200 })
  }
  catch {
    showToast({ theme: 'warning', message: '已取消', duration: 1000 })
  }
}

watch(count, (newValue, oldValue) => {
  console.log(`[wevu] count changed: ${oldValue} -> ${newValue}`)
})

function onMessageChange(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
  message.value = e.detail.value
}

function onMessageClear() {
  message.value = ''
}

function onNewTodoChange(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
  newTodo.value = e.detail.value
}

function onNewTodoClear() {
  newTodo.value = ''
}

function addTodo() {
  const value = newTodo.value.trim()
  if (!value) {
    showToast({ theme: 'warning', message: '请输入内容', duration: 1000 })
    return
  }
  todos.value.push(value)
  newTodo.value = ''
  showToast({ theme: 'success', message: '已添加', duration: 1000 })
}

function onTodoChange(e: WechatMiniprogram.CustomEvent<{ value: Array<string | number> }>) {
  checkedTodos.value = e.detail.value
}

function formatDelta(delta?: number, unit = '') {
  if (delta === undefined || Number.isNaN(delta)) {
    return '--'
  }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}${unit}`
}
</script>

<template>
  <view class="box-border min-h-screen bg-[#f6f7fb] px-[32rpx] pb-[64rpx] pt-[48rpx] text-[#1c1c3c]">
    <HelloWorld
      :title="message"
      :subtitle="subtitle"
      :kpis="kpis"
    >
      <template #badge>
        <view class="rounded-full bg-white/85 px-[16rpx] py-[6rpx]">
          <text class="text-[22rpx] font-semibold text-[#1c1c3c]">
            badge 插槽
          </text>
        </view>
      </template>
      <template #default>
        <view class="flex flex-wrap gap-[12rpx]">
          <view class="rounded-[16rpx] bg-white/85 px-[16rpx] py-[8rpx]">
            <text class="text-[22rpx] font-medium text-[#1c1c3c]">
              标题长度：{{ message.length }}
            </text>
          </view>
          <view class="rounded-[16rpx] bg-white/80 px-[16rpx] py-[8rpx]">
            <text class="text-[22rpx] font-medium text-[#1c1c3c]">
              副标题：{{ subtitle || '暂无' }}
            </text>
          </view>
        </view>
      </template>
      <template #kpi="{ item, index, tone, isHot }">
        <view class="rounded-[18rpx] bg-white/95 p-[18rpx] shadow-[0_12rpx_24rpx_rgba(17,24,39,0.12)]">
          <view class="flex items-center justify-between">
            <view class="flex items-center gap-[8rpx]">
              <view
                class="h-[8rpx] w-[8rpx] rounded-full"
                :class="tone === 'positive' ? 'bg-[#22c55e]' : tone === 'negative' ? 'bg-[#ef4444]' : 'bg-[#94a3b8]'"
              />
              <text class="text-[22rpx] text-[#5e5e7b]">
                {{ item.label }}
              </text>
            </view>
            <view v-if="isHot" class="rounded-full bg-[#fff3c2] px-[12rpx] py-[4rpx]">
              <text class="text-[18rpx] font-semibold text-[#8a5200]">
                TOP {{ index + 1 }}
              </text>
            </view>
          </view>
          <view class="mt-[12rpx] flex items-end justify-between">
            <view class="flex items-baseline gap-[6rpx]">
              <text class="text-[36rpx] font-bold text-[#1c1c3c]">
                {{ item.value }}
              </text>
              <text v-if="item.unit" class="text-[20rpx] text-[#6b6b88]">
                {{ item.unit }}
              </text>
            </view>
            <view
              class="rounded-full px-[12rpx] py-[4rpx] text-[20rpx] font-semibold"
              :class="tone === 'positive' ? 'bg-[#e7f7ee] text-[#1b7a3a]' : tone === 'negative' ? 'bg-[#ffe9e9] text-[#b42318]' : 'bg-[#edf1f7] text-[#64748b]'"
            >
              {{ tone === 'positive' ? '↑' : tone === 'negative' ? '↓' : '→' }}
              {{ formatDelta(item.delta, item.unit ?? '') }}
            </view>
          </view>
          <text v-if="item.footnote" class="mt-[6rpx] block text-[20rpx] text-[#8a8aa5]">
            {{ item.footnote }}
          </text>
        </view>
      </template>
    </HelloWorld>

    <view
      class="mt-[24rpx] rounded-[24rpx] bg-white p-[32rpx] shadow-[0_12rpx_32rpx_rgb(44_44_84_/_10%)]"
    >
      <t-cell-group title="计数器" theme="card">
        <t-cell title="当前计数" :note="`${count}`" />
        <t-cell title="双倍" :note="`${doubled}`" />
      </t-cell-group>

      <view class="mt-[24rpx] flex gap-[16rpx]">
        <t-button block size="large" theme="primary" style="flex: 1" @tap="increment">
          +1
        </t-button>
        <t-button block size="large" theme="danger" variant="outline" style="flex: 1" @tap="reset">
          重置
        </t-button>
      </view>

      <view class="mt-[24rpx]">
        <t-input
          label="标题"
          placeholder="输入标题…"
          clearable
          :value="message"
          @change="onMessageChange"
          @clear="onMessageClear"
        />
      </view>

      <view class="mt-[24rpx]">
        <t-input
          label="新增待办"
          placeholder="输入一条待办…"
          clearable
          :value="newTodo"
          @change="onNewTodoChange"
          @clear="onNewTodoClear"
        />
        <view class="mt-[16rpx]">
          <t-button block size="large" theme="primary" variant="dashed" @tap="addTodo">
            添加
          </t-button>
        </view>
      </view>

      <view class="mt-[24rpx]">
        <t-cell-group :title="`Checklist（已完成 ${checkedCount}/${todos.length}）`" theme="card">
          <t-checkbox-group :options="todoOptions" :value="checkedTodos" @change="onTodoChange" />
        </t-cell-group>
      </view>
    </view>

    <t-toast id="t-toast" />
    <t-dialog id="t-dialog" />
  </view>
</template>
