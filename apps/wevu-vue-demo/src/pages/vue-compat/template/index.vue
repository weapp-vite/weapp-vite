<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: '模板语法对照',
})

interface TodoItem {
  id: number
  title: string
  done: boolean
}

interface EntryObject {
  key: string
  value: string
}

const query = ref('')
const mode = ref<'all' | 'done' | 'todo'>('all')
const colorMode = ref<'warm' | 'cool'>('warm')
const todos = ref<TodoItem[]>([
  { id: 1, title: 'v-for 数组遍历', done: true },
  { id: 2, title: 'v-if / v-else-if / v-else 分支', done: false },
  { id: 3, title: 'v-model 输入绑定', done: false },
])
const entries = ref<Array<[string, string]>>([
  ['source', 'script-setup import in template'],
  ['scope', 'page'],
])
const eventLogs = ref<string[]>([])
const entryObjects = ref<EntryObject[]>(entries.value.map(([key, value]) => ({
  key,
  value,
})))
const nextEntryId = ref(1)

const filtered = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  return todos.value.filter((item) => {
    const modeMatch = mode.value === 'all'
      || (mode.value === 'done' && item.done)
      || (mode.value === 'todo' && !item.done)
    const textMatch = !keyword || item.title.toLowerCase().includes(keyword)
    return modeMatch && textMatch
  })
})

const panelStyle = computed(() => {
  return colorMode.value === 'warm'
    ? { background: '#fff4ec', color: '#7a3f00' }
    : { background: '#edf4ff', color: '#0c3e75' }
})

const panelClass = computed(() => {
  return {
    'filter-panel': true,
    'active': mode.value !== 'all',
  }
})

const summaryMap = computed(() => Object.fromEntries(entries.value))

function setMode(next: 'all' | 'done' | 'todo') {
  mode.value = next
}

function toggleTheme() {
  colorMode.value = colorMode.value === 'warm' ? 'cool' : 'warm'
}

function toggleDone(id: number) {
  todos.value = todos.value.map((todo) => {
    if (todo.id !== id) {
      return todo
    }
    return {
      ...todo,
      done: !todo.done,
    }
  })
}

function addEntry() {
  const next = {
    key: `dynamic-${nextEntryId.value}`,
    value: `value-${nextEntryId.value}`,
  }
  nextEntryId.value += 1
  entries.value = [...entries.value, [next.key, next.value]]
  entryObjects.value = [...entryObjects.value, next]
}

function removeEntry() {
  if (entries.value.length <= 1 || entryObjects.value.length <= 1) {
    return
  }
  entries.value = entries.value.slice(0, -1)
  entryObjects.value = entryObjects.value.slice(0, -1)
}

function updateFirstEntryValue() {
  if (!entries.value.length || !entryObjects.value.length) {
    return
  }
  const [firstKey, firstValue] = entries.value[0]
  const nextValue = firstValue.includes('[updated]')
    ? `${firstValue}*`
    : `${firstValue} [updated]`

  entries.value = [[firstKey, nextValue], ...entries.value.slice(1)]
  entryObjects.value = entryObjects.value.map((entry, index) => {
    if (index !== 0) {
      return entry
    }
    return {
      ...entry,
      value: nextValue,
    }
  })
}

function onNativeEventWithArgs(name: string, tag: string, event: { type?: string, timeStamp?: number, detail?: Record<string, any> }) {
  const type = event?.type ?? 'unknown'
  const timeStamp = event?.timeStamp ?? 'n/a'
  const detail = event?.detail && typeof event.detail === 'object'
    ? Object.keys(event.detail).join(',') || 'empty'
    : 'none'
  eventLogs.value = [`${name}/${tag} -> type=${type} time=${timeStamp} detailKeys=${detail}`, ...eventLogs.value].slice(0, 8)
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="title">
        模板语法对照
      </text>
      <text class="subtitle">
        覆盖 v-if / v-for / v-model / class-style 绑定。
      </text>
    </view>

    <view class="section" :class="[panelClass]" :style="panelStyle">
      <text class="section-title">
        过滤器面板（:class + :style）
      </text>
      <view class="row">
        <button class="btn light" @tap="setMode('all')">
          全部
        </button>
        <button class="btn light" @tap="setMode('done')">
          已完成
        </button>
        <button class="btn light" @tap="setMode('todo')">
          未完成
        </button>
        <button class="btn secondary" @tap="toggleTheme">
          切换色板
        </button>
      </view>
      <input
        v-model="query"
        class="input"
        placeholder="输入关键字（v-model）"
      >
    </view>

    <view class="section">
      <text class="section-title">
        列表与条件分支
      </text>
      <view v-if="filtered.length" class="card-list">
        <view v-for="item in filtered" :key="item.id" class="card">
          <text class="card-title">
            {{ item.title }}
          </text>
          <text class="card-meta">
            状态：{{ item.done ? 'done' : 'todo' }}
          </text>
          <button class="btn" @tap="toggleDone(item.id)">
            切换状态
          </button>
        </view>
      </view>
      <view v-else-if="mode === 'done' || mode === 'todo'">
        <text class="card-meta">
          {{ mode === 'done' ? '已完成' : '未完成' }}筛选下没有匹配项（v-else-if 分支）
        </text>
      </view>
      <view v-else>
        <text class="card-meta">
          没有匹配项（v-else 分支）
        </text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        动态数组变更（新增 / 删除 / 修改）
      </text>
      <view class="row">
        <button class="btn light" @tap="addEntry">
          新增一项
        </button>
        <button class="btn light" @tap="removeEntry">
          删除最后一项
        </button>
        <button class="btn light" @tap="updateFirstEntryValue">
          修改首项 value
        </button>
      </view>
      <text class="card-meta">
        entries: {{ entries.length }}，entryObjects: {{ entryObjects.length }}
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        对象遍历（v-for in Object.entries）
      </text>
      <view v-for="([key, value], index) in entries" :key="key" class="row">
        <text class="card-meta">
          {{ index + 1 }}. {{ key }} = {{ value }}
        </text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        对象解构（v-for in Object[]）
      </text>
      <view v-for="({ key, value }, index) in entryObjects" :key="key" class="row">
        <text class="card-meta">
          {{ index + 1 }}. {{ key }} = {{ value }}
        </text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        直接遍历对象（v-for in Object）
      </text>
      <view v-for="(value, key) in summaryMap" :key="key" class="row">
        <text class="card-meta">
          {{ key }} = {{ value }}
        </text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        单节点多事件（参数 + $event）
      </text>
      <view
        class="event-zone"
        @tap="onNativeEventWithArgs('tap', 'zone', $event)"
        @longpress="onNativeEventWithArgs('longpress', 'zone', $event)"
        @touchstart="onNativeEventWithArgs('touchstart', 'zone', $event)"
        @touchmove="onNativeEventWithArgs('touchmove', 'zone', $event)"
        @touchend="onNativeEventWithArgs('touchend', 'zone', $event)"
        @touchcancel="onNativeEventWithArgs('touchcancel', 'zone', $event)"
      >
        <text class="card-title">
          在这个 view 上点击、长按、滑动触发不同事件
        </text>
        <text class="event-tip">
          每个监听都使用统一签名：handler('eventName', 'tag', $event)
        </text>
      </view>
      <view v-if="eventLogs.length" class="card-list">
        <view v-for="(line, index) in eventLogs" :key="`event-log-${index}`" class="card">
          <text class="card-meta">
            {{ line }}
          </text>
        </view>
      </view>
      <view v-else>
        <text class="card-meta">
          暂无事件日志，请在上方区域进行操作。
        </text>
      </view>
    </view>
  </view>
</template>

<style>
@import '../shared.css';

.filter-panel.active {
  border: 2rpx solid #f2b266;
}

.event-zone {
  padding: 18rpx;
  margin-bottom: 16rpx;
  background: #f6fbff;
  border: 2rpx dashed #7ab6ff;
  border-radius: 14rpx;
}

.event-tip {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #2f5f9c;
}
</style>
