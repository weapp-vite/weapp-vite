<script setup lang="ts">
import { computed, onShow, ref, watch } from 'wevu'
import InteractiveUsagePanel from '../../components/InteractiveUsagePanel.vue'

definePageJson({
  navigationBarTitleText: 'wevu + tailwind 快速演示',
})

type Tone = 'sky' | 'emerald' | 'amber'
type Mode = 'light' | 'dark'

const count = ref(1)
const step = ref(2)
const tone = ref<Tone>('sky')
const mode = ref<Mode>('light')
const showBadge = ref(true)
const keyword = ref('we')
const tags = ref(['ref', 'computed', 'watch', 'onShow', 'props', 'emit', 'v-model', 'dark-mode'])
const logs = ref<string[]>([])

const doubled = computed(() => count.value * 2)
const titleClass = computed(() => {
  if (mode.value === 'dark') {
    return count.value % 2 === 0 ? 'text-emerald-200' : 'text-sky-200'
  }
  return count.value % 2 === 0 ? 'text-emerald-700' : 'text-sky-700'
})
const filteredTags = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  if (!q) return tags.value
  return tags.value.filter(tag => tag.toLowerCase().includes(q))
})
const modeIcon = computed(() => (mode.value === 'light' ? '🌙' : '☀️'))
const summary = computed(() => `mode ${mode.value} / count ${count.value} / doubled ${doubled.value} / step ${step.value} / q ${keyword.value}`)

watch(count, (next) => {
  logs.value = [`watch: count -> ${next}`, ...logs.value].slice(0, 3)
})

onShow(() => {
  logs.value = ['onShow: 页面可见', ...logs.value].slice(0, 3)
})

watch(keyword, (next) => {
  logs.value = [`watch: keyword -> ${next || '(empty)'}`, ...logs.value].slice(0, 3)
})

function addCount() {
  count.value += 1
}

function minusCount() {
  count.value = Math.max(0, count.value - 1)
}

function toggleBadge() {
  showBadge.value = !showBadge.value
}

function switchMode() {
  mode.value = mode.value === 'light' ? 'dark' : 'light'
}

function increaseStep() {
  step.value = Math.min(5, step.value + 1)
}

function decreaseStep() {
  step.value = Math.max(1, step.value - 1)
}

function switchTone() {
  const tones: Tone[] = ['sky', 'emerald', 'amber']
  const current = tones.indexOf(tone.value)
  tone.value = tones[(current + 1) % tones.length]
}

function handlePlusFromChild(next: number) {
  logs.value = [`emit: plus -> ${next}`, ...logs.value].slice(0, 3)
}

function handleToneChange(next: Tone) {
  tone.value = next
}
</script>

<template>
  <view
    class="min-h-screen space-y-4 p-4 transition-colors duration-300"
    :class="mode === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-slate-900 text-slate-100'"
  >
    <view
      class="space-y-2 rounded-2xl p-4 shadow-sm transition-colors duration-300"
      :class="mode === 'light' ? 'bg-white' : 'bg-slate-800'"
    >
      <text class="block text-lg font-bold" :class="titleClass">
        wevu + tailwindcss
      </text>
      <text class="block text-xs" :class="mode === 'light' ? 'text-slate-500' : 'text-slate-300'">
        ref / computed / watch / onShow / props / emit / v-model
      </text>
      <text class="block text-sm" :class="mode === 'light' ? 'text-slate-700' : 'text-slate-200'">
        {{ summary }}
      </text>

      <view class="flex items-center justify-between">
        <view class="flex items-center gap-4">
          <view class="h-16 w-16 bg-[url(https://vite.icebreaker.top/logo.png)] bg-[length:100%_100%] bg-no-repeat"></view>
          <view class="h-12 w-16 bg-[url(https://vite.icebreaker.top/tw-logo.png)] bg-[length:100%_100%] bg-no-repeat"></view>
        </view>
        <button size="mini" class="flex items-center gap-1" @tap="switchMode">
          <text class="text-base leading-none">{{ modeIcon }}</text>
          <text>{{ mode === 'light' ? '切暗色' : '切亮色' }}</text>
        </button>
      </view>

      <view class="flex gap-2">
        <button size="mini" class="flex-1" @tap="minusCount">-1</button>
        <button size="mini" class="flex-1" type="primary" @tap="addCount">+1</button>
      </view>

      <view class="flex gap-2">
        <button size="mini" class="flex-1" @tap="decreaseStep">step -</button>
        <button size="mini" class="flex-1" @tap="increaseStep">step +</button>
        <button size="mini" class="flex-1" @tap="switchTone">tone</button>
      </view>

      <button size="mini" @tap="toggleBadge">
        {{ showBadge ? '隐藏' : '显示' }} badge
      </button>

      <input
        v-model="keyword"
        class="w-full rounded-xl border px-3 py-2 text-sm"
        :class="mode === 'light' ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-600 bg-slate-900 text-slate-100'"
        placeholder="输入关键字过滤 tags（v-model）"
      />

      <view class="flex flex-wrap gap-2">
        <text
          v-for="tag in filteredTags"
          :key="tag"
          class="rounded-lg px-2 py-1 text-xs"
          :class="mode === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-slate-700 text-slate-200'"
        >
          {{ tag }}
        </text>
      </view>

      <view
        v-if="logs.length"
        class="rounded-xl p-2"
        :class="mode === 'light' ? 'bg-slate-100' : 'bg-slate-900'"
      >
        <text
          v-for="item in logs"
          :key="item"
          class="block text-xs"
          :class="mode === 'light' ? 'text-slate-500' : 'text-slate-300'"
        >
          {{ item }}
        </text>
      </view>
    </view>

    <InteractiveUsagePanel
      v-model="count"
      title="组件 props 交互区"
      :step="step"
      :tone="tone"
      :mode="mode"
      :badge="showBadge"
      :tags="filteredTags"
      @plus="handlePlusFromChild"
      @tone-change="handleToneChange"
    />
  </view>
</template>
