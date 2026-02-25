<script setup lang="ts">
import { computed, ref } from 'wevu'
import { compatMatrix } from './matrix'

definePageJson({
  navigationBarTitleText: 'Vue 能力矩阵',
})

const category = ref<'all' | 'template' | 'reactivity' | 'script-setup' | 'component' | 'build'>('all')

const filtered = computed(() => {
  if (category.value === 'all') {
    return compatMatrix
  }
  return compatMatrix.filter(item => item.category === category.value)
})

const passCount = computed(() => compatMatrix.filter(item => item.status === 'pass').length)
const partialCount = computed(() => compatMatrix.filter(item => item.status === 'partial').length)
const failCount = computed(() => compatMatrix.filter(item => item.status === 'fail').length)

function setCategory(next: typeof category.value) {
  category.value = next
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="title">
        Vue 能力兼容矩阵
      </text>
      <text class="subtitle">
        每条语法能力按 pass / partial / fail 分类记录，便于持续回归。
      </text>
      <view class="row">
        <text class="badge pass">
          pass: {{ passCount }}
        </text>
        <text class="badge partial">
          partial: {{ partialCount }}
        </text>
        <text class="badge fail">
          fail: {{ failCount }}
        </text>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        分类筛选
      </text>
      <view class="row">
        <button class="btn light" @tap="setCategory('all')">
          all
        </button>
        <button class="btn light" @tap="setCategory('template')">
          template
        </button>
        <button class="btn light" @tap="setCategory('reactivity')">
          reactivity
        </button>
      </view>
      <view class="row">
        <button class="btn light" @tap="setCategory('script-setup')">
          script-setup
        </button>
        <button class="btn light" @tap="setCategory('component')">
          component
        </button>
        <button class="btn light" @tap="setCategory('build')">
          build
        </button>
      </view>
    </view>

    <view class="section">
      <text class="section-title">
        详细条目（{{ filtered.length }}）
      </text>
      <view class="card-list">
        <view v-for="item in filtered" :key="item.id" class="card">
          <view class="row">
            <text class="card-title">
              {{ item.feature }}
            </text>
            <text class="badge" :class="[item.status]">
              {{ item.status }}
            </text>
          </view>
          <text class="card-meta">
            category: {{ item.category }}
          </text>
          <text class="card-meta">
            sample: {{ item.sample }}
          </text>
          <text class="card-meta">
            notes: {{ item.notes }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style>
@import '../shared.css';
</style>
