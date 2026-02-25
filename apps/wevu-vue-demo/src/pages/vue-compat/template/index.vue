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

const query = ref('')
const mode = ref<'all' | 'done' | 'todo'>('all')
const colorMode = ref<'warm' | 'cool'>('warm')
const todos = ref<TodoItem[]>([
  { id: 1, title: 'v-for 数组遍历', done: true },
  { id: 2, title: 'v-if / v-else 分支', done: false },
  { id: 3, title: 'v-model 输入绑定', done: false },
])
const summary = ref({ source: 'script-setup import in template', scope: 'page' })

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

const entries = computed(() => Object.entries(summary.value))
const entryObjects = computed(() => {
  return Object.entries(summary.value).map(([key, value]) => ({
    key,
    value,
  }))
})
const summaryMap = computed(() => summary.value)

function setMode(next: 'all' | 'done' | 'todo') {
  mode.value = next
}

function toggleTheme() {
  colorMode.value = colorMode.value === 'warm' ? 'cool' : 'warm'
}

function toggleDone(id: number) {
  todos.value = todos.value.map((item) => {
    if (item.id !== id) {
      return item
    }
    return {
      ...item,
      done: !item.done,
    }
  })
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
      <view v-else>
        <text class="card-meta">
          没有匹配项（v-else 分支）
        </text>
      </view>
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
  </view>
</template>

<style>
@import '../shared.css';

.filter-panel.active {
  border: 2rpx solid #f2b266;
}
</style>
