<script setup lang="ts">
import { computed, ref } from 'wevu'
import NativeUsesVue from '../../../native/native-uses-vue/index'
import VueCard from '../../../components/vue-card/index.vue'

definePageJson({
  navigationBarTitleText: '组件互操作',
})

const modeOrder = ['basic', 'contrast'] as const
const modeIndex = ref(0)
const changeCount = ref(0)

const mode = computed(() => modeOrder[modeIndex.value] ?? modeOrder[0])

function toggleMode() {
  modeIndex.value = (modeIndex.value + 1) % modeOrder.length
  changeCount.value += 1
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="title">
        组件互操作（native -> vue）
      </text>
      <text class="subtitle">
        验证原生组件可通过 usingComponents 引入 Vue 组件并透传 props。
      </text>
      <view class="row">
        <text class="badge pass">
          mode: {{ mode }}
        </text>
        <text class="badge">
          count: {{ changeCount }}
        </text>
      </view>
      <button class="btn" @tap="toggleMode">
        切换模式
      </button>
    </view>

    <view class="section">
      <text class="section-title">
        页面直接渲染 Vue 组件
      </text>
      <VueCard
        :title="`页面 -> Vue（${mode}）`"
        subtitle="页面可直接使用 Vue SFC"
        :badge="mode === 'contrast' ? 'Vue-Hi' : 'Vue'"
      >
        <text class="card-meta">
          这部分没有经过原生包装，作为对照组。
        </text>
      </VueCard>
    </view>

    <view class="section">
      <text class="section-title">
        页面 -> 原生组件 -> Vue 组件
      </text>
      <NativeUsesVue
        title="native -> vue 静态链路"
        subtitle="原生组件内 usingComponents -> Vue SFC"
        badge="Mixed"
        note="这个示例用于验证原生组件内部直接渲染 Vue 组件。"
      />
      <text class="section-desc">
        关键点：`native-uses-vue/index.json` 的 `usingComponents` 指向 `/components/vue-card/index`，属性可由原生组件继续下传给 Vue。
      </text>
    </view>
  </view>
</template>

<style>
@import '../shared.css';
</style>
