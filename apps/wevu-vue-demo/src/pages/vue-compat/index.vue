<script setup lang="ts">
import { computed } from 'wevu'
import { compatCheckResult, vueCompatCases } from './cases'

definePageJson({
  navigationBarTitleText: 'Vue 兼容性对照',
})

const passCount = computed(() => {
  return vueCompatCases.filter(item => item.status === 'pass').length
})

const partialCount = computed(() => {
  return vueCompatCases.filter(item => item.status === 'partial').length
})

const failCount = computed(() => {
  return vueCompatCases.filter(item => item.status === 'fail').length
})

function jump(url: string) {
  wx.navigateTo({ url })
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="title">
        Vue 语法兼容性对照
      </text>
      <text class="subtitle">
        依据 vuejs 文档能力点，在 wevu-vue-demo 中按目录复刻验证。
      </text>
      <view class="row">
        <text class="badge pass">
          typecheck: {{ compatCheckResult.typecheck }}
        </text>
        <text class="badge pass">
          build: {{ compatCheckResult.build }}
        </text>
        <text class="badge">
          lint: pass
        </text>
      </view>
      <text class="section-desc">
        {{ compatCheckResult.note }}，pass {{ passCount }} / partial {{ partialCount }} / fail {{ failCount }}。
      </text>
    </view>

    <view class="section">
      <text class="section-title">
        对照目录
      </text>
      <view class="card-list">
        <view v-for="item in vueCompatCases" :key="item.key" class="card">
          <view class="row">
            <text class="card-title">
              {{ item.title }}
            </text>
            <text class="badge" :class="[item.status]">
              {{ item.status === 'pass' ? '通过' : item.status === 'partial' ? '部分通过' : item.status === 'fail' ? '不通过' : '待确认' }}
            </text>
          </view>
          <text class="card-meta">
            能力点：{{ item.focus }}
          </text>
          <text class="card-meta">
            文档主题：{{ item.llmsTopic }}
          </text>
          <button class="btn" @tap="jump(item.path)">
            打开对照页
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
@import './shared.css';
</style>
