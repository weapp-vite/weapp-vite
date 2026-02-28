<script setup lang="ts">
import { computed, reactive, ref, watch } from 'wevu'

import SectionTitle from '@/components/SectionTitle/index.vue'

definePageJson({
  navigationBarTitleText: 'Class 绑定',
  backgroundColor: '#f6f7fb',
})

const isActive = ref(true)
const hasError = ref(false)
const isRound = ref(false)
const isGhost = ref(false)

function resolveSwitchValue(event: unknown, fallback: boolean) {
  if (typeof event === 'boolean') {
    return event
  }
  if (event && typeof event === 'object') {
    const payload = event as Record<string, any>
    const detail = payload.detail
    if (typeof detail === 'boolean') {
      return detail
    }
    if (detail && typeof detail === 'object' && typeof detail.value === 'boolean') {
      return detail.value
    }
    if (typeof payload.value === 'boolean') {
      return payload.value
    }
  }
  return fallback
}

function onActiveChange(event: unknown) {
  isActive.value = resolveSwitchValue(event, !isActive.value)
}

function onErrorChange(event: unknown) {
  hasError.value = resolveSwitchValue(event, !hasError.value)
}

function onRoundChange(event: unknown) {
  isRound.value = resolveSwitchValue(event, !isRound.value)
}

function onGhostChange(event: unknown) {
  isGhost.value = resolveSwitchValue(event, !isGhost.value)
}

const classObject = reactive({
  'demo-active': true,
  'text-danger': false,
  'demo-round': false,
  'demo-ghost': false,
})

watch([isActive, hasError, isRound, isGhost], ([active, error, round, ghost]) => {
  classObject['demo-active'] = active
  classObject['text-danger'] = error
  classObject['demo-round'] = round
  classObject['demo-ghost'] = ghost
}, { immediate: true })

const activeClass = ref('demo-active')
const errorClass = ref('text-danger')
const roundClass = ref('demo-round')
const ghostClass = ref('demo-ghost')

const activeClassIf = computed(() => (isActive.value ? activeClass.value : ''))
const errorClassIf = computed(() => (hasError.value ? errorClass.value : ''))
const roundClassIf = computed(() => (isRound.value ? roundClass.value : ''))
const ghostClassIf = computed(() => (isGhost.value ? ghostClass.value : ''))
const dynamicKeyClass = computed(() => ({ [activeClass.value]: isActive.value }))

const styleObject = computed(() => ({
  background: hasError.value
    ? '#fff1f2'
    : isActive.value
      ? 'linear-gradient(135deg,#2563eb,#6366f1)'
      : '#ffffff',
  borderColor: hasError.value ? '#ef4444' : isActive.value ? '#1e40af' : '#d7d9f2',
  borderStyle: isGhost.value ? 'dashed' : 'solid',
  borderRadius: isRound.value ? '999rpx' : '18rpx',
  color: hasError.value ? '#b91c1c' : isActive.value ? '#ffffff' : '#1f1a3f',
}))

const styleArray = computed(() => ([
  { transition: 'all 0.2s ease' },
  isActive.value ? { transform: 'translateY(-4rpx)' } : { transform: 'translateY(0rpx)' },
  hasError.value
    ? { boxShadow: '0 18rpx 32rpx rgba(239,68,68,0.2)' }
    : { boxShadow: '0 10rpx 20rpx rgba(37,99,235,0.28)' },
  isRound.value ? { borderRadius: '999rpx' } : { borderRadius: '18rpx' },
  isGhost.value ? { opacity: '0.78' } : { opacity: '1' },
]))

const styleString = computed(() => {
  const fontSize = isActive.value ? 26 : 24
  const color = hasError.value ? '#b91c1c' : '#1f1a3f'
  const spacing = isGhost.value ? 1.2 : 0.5
  return `font-size:${fontSize}rpx;color:${color};letter-spacing:${spacing}rpx;`
})

const styleWithVar = computed(() => {
  const accent = hasError.value ? '#ef4444' : '#2563eb'
  return {
    '--lab-accent': accent,
    'borderColor': 'var(--lab-accent)',
    'color': 'var(--lab-accent)',
  }
})

function applyScenarioBase() {
  isActive.value = false
  hasError.value = false
  isRound.value = false
  isGhost.value = false
}

function applyScenarioAllOn() {
  isActive.value = true
  hasError.value = true
  isRound.value = true
  isGhost.value = true
}

function applyScenarioMixed() {
  isActive.value = true
  hasError.value = false
  isRound.value = true
  isGhost.value = false
}

function applyScenarioErrorGhost() {
  isActive.value = false
  hasError.value = true
  isRound.value = false
  isGhost.value = true
}

function runE2EState() {
  return {
    isActive: isActive.value,
    hasError: hasError.value,
    isRound: isRound.value,
    isGhost: isGhost.value,
    classObject: { ...classObject },
    activeClassIf: activeClassIf.value,
    errorClassIf: errorClassIf.value,
    roundClassIf: roundClassIf.value,
    ghostClassIf: ghostClassIf.value,
    styleString: styleString.value,
  }
}
</script>

<template>
  <view class="min-h-screen bg-[#f6f7fb] px-[28rpx] pb-[88rpx] pt-[24rpx] text-[#1c1c3c]">
    <view class="rounded-[28rpx] bg-gradient-to-br from-[#eef2ff] via-[#ffffff] to-[#e0f2fe] p-[20rpx]">
      <SectionTitle title="Class 绑定实验室" subtitle="切换状态观察 Vue 3 class 绑定效果" />
    </view>

    <view class="mt-[18rpx] rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
      <SectionTitle title="状态控制" subtitle="开关影响所有示例" />
      <view class="mt-[12rpx] grid grid-cols-2 gap-[12rpx]">
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Active
            </text>
            <t-switch :value="isActive" @change="onActiveChange" />
          </view>
        </view>
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Error
            </text>
            <t-switch :value="hasError" @change="onErrorChange" />
          </view>
        </view>
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Round
            </text>
            <t-switch :value="isRound" @change="onRoundChange" />
          </view>
        </view>
        <view class="rounded-[16rpx] bg-[#f8fafc] p-[12rpx]">
          <view class="flex items-center justify-between">
            <text class="text-[22rpx] text-[#5c5b7a]">
              Ghost
            </text>
            <t-switch :value="isGhost" @change="onGhostChange" />
          </view>
        </view>
      </view>
      <view class="mt-[12rpx] flex flex-wrap gap-[12rpx]">
        <t-button size="small" variant="outline" @tap="applyScenarioBase">
          Base
        </t-button>
        <t-button size="small" variant="outline" @tap="applyScenarioAllOn">
          All On
        </t-button>
        <t-button size="small" variant="outline" @tap="applyScenarioMixed">
          Mixed
        </t-button>
        <t-button size="small" variant="outline" @tap="applyScenarioErrorGhost">
          Error+Ghost
        </t-button>
      </view>
    </view>

    <view class="mt-[18rpx] space-y-[14rpx]">
      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="对象语法" subtitle="状态驱动 class" />
        <view class="mt-[12rpx] demo-block" data-e2e="class-object" :class="{ 'demo-active': isActive }">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Object Syntax
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              active 触发高亮
            </text>
          </view>
          <view class="demo-chip">
            Obj
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="静态 + 对象" subtitle="静态 class + 动态对象" />
        <view
          class="mt-[12rpx] demo-block demo-ghost"
          data-e2e="class-static-object"
          :class="{ 'demo-active': isActive, 'text-danger': hasError }"
        >
          <view>
            <text class="block text-[24rpx] font-semibold">
              Static + Object
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              error 显示警示色
            </text>
          </view>
          <view class="demo-chip">
            Mix
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="响应式对象" subtitle="reactive classObject" />
        <view class="mt-[12rpx] demo-block" data-e2e="class-reactive" :class="classObject">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Reactive Object
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              多状态合并控制
            </text>
          </view>
          <view class="demo-chip">
            Obj+
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="数组语法" subtitle="数组传入多个 class" />
        <view class="mt-[12rpx] demo-block" data-e2e="class-array" :class="[activeClassIf, errorClassIf, roundClassIf]">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Array Syntax
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              组合多个 class
            </text>
          </view>
          <view class="demo-chip">
            Arr
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="数组条件" subtitle="条件判断决定 class" />
        <view class="mt-[12rpx] demo-block" data-e2e="class-cond-array" :class="[isActive ? activeClass : '', errorClassIf]">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Conditional Array
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              条件表达式返回 class
            </text>
          </view>
          <view class="demo-chip">
            Cond
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="数组 + 动态 key" subtitle="对象 + 字符串混合" />
        <view class="mt-[12rpx] demo-block" data-e2e="class-array-key" :class="[dynamicKeyClass, errorClassIf, ghostClassIf]">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Array + Key
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              支持计算属性 key
            </text>
          </view>
          <view class="demo-chip">
            Key
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="Style 对象语法" subtitle="对象绑定动态 style" />
        <view class="mt-[12rpx] demo-block demo-style-anchor" data-e2e="style-object" :style="styleObject">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Style Object
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              多属性对象绑定
            </text>
          </view>
          <view class="demo-chip">
            StyObj
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="Style 数组语法" subtitle="按状态合并样式片段" />
        <view class="mt-[12rpx] demo-block demo-style-anchor" data-e2e="style-array" :style="styleArray">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Style Array
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              条件 style 片段
            </text>
          </view>
          <view class="demo-chip">
            StyArr
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="Style 字符串语法" subtitle="拼接结果直出字符串" />
        <view class="mt-[12rpx] demo-block demo-style-anchor" data-e2e="style-string" :style="styleString">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Style String
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              string 绑定与条件拼接
            </text>
          </view>
          <view class="demo-chip">
            StyStr
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-white p-[20rpx] shadow-[0_18rpx_40rpx_rgba(17,24,39,0.08)]">
        <SectionTitle title="Style 变量语法" subtitle="CSS 变量与对象混合" />
        <view class="mt-[12rpx] demo-block demo-style-anchor" data-e2e="style-var" :style="styleWithVar">
          <view>
            <text class="block text-[24rpx] font-semibold">
              Style Variable
            </text>
            <text class="mt-[6rpx] block text-[20rpx] demo-subtext">
              变量透传与消费
            </text>
          </view>
          <view class="demo-chip">
            StyVar
          </view>
        </view>
      </view>

      <view class="rounded-[24rpx] bg-[#111827] p-[18rpx] text-white">
        <text class="text-[20rpx] text-slate-300">
          E2E 状态快照
        </text>
        <text class="mt-[8rpx] block text-[20rpx]" data-e2e="state-line">
          {{ runE2EState() }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.demo-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  color: #1f1a3f;
  background: #fff;
  border: 2rpx solid #d7d9f2;
  border-radius: 18rpx;
  transition: all 0.2s ease;
}

.demo-chip {
  padding: 6rpx 16rpx;
  font-size: 18rpx;
  letter-spacing: 0.5rpx;
  border: 2rpx solid currentcolor;
  border-radius: 999rpx;
}

.demo-subtext {
  color: currentcolor;
  opacity: 0.82;
}

.demo-ghost {
  background: #f8fafc;
  border-style: dashed;
}

.demo-round {
  border-radius: 999rpx;
}

.demo-active {
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #6366f1);
  border-color: #1e40af;
  box-shadow: 0 18rpx 32rpx rgb(37 99 235 / 35%);
  transform: translateY(-4rpx);
}

.text-danger {
  color: #b91c1c;
  background: #fff1f2;
  border-color: #ef4444;
  box-shadow: 0 18rpx 32rpx rgb(239 68 68 / 20%);
}

.demo-style-anchor {
  border-color: #d7d9f2;
  border-style: solid;
  border-width: 2rpx;
}
</style>
