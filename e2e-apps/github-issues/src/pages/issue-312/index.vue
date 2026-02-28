<script setup lang="ts">
import { computed, ref } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-312',
  backgroundColor: '#ffffff',
})

const options = [
  { label: '选项1', value: 1 },
  { label: '选项2', value: 2 },
  { label: '选项3', value: 3 },
]

const index = ref(0)
const option = computed(() => options[index.value])

function inc() {
  if (index.value >= options.length - 1) {
    return
  }
  index.value += 1
}

function dec() {
  if (index.value <= 0) {
    return
  }
  index.value -= 1
}

function _runE2E() {
  return {
    ok: option.value.label === options[index.value].label,
    index: index.value,
    label: option.value.label,
    value: option.value.value,
  }
}
</script>

<template>
  <view class="issue312-page">
    <text class="issue312-title">
      issue-312 computed object round trip
    </text>
    <text class="issue312-current">
      current option: {{ option.label }}
    </text>
    <text class="issue312-index">
      index: {{ index }}
    </text>
    <view
      class="issue312-probe"
      :data-current-label="option.label"
      :data-current-index="index"
    />

    <button
      class="issue312-btn issue312-btn-inc"
      @tap="inc"
    >
      +1
    </button>
    <button
      class="issue312-btn issue312-btn-dec"
      @tap="dec"
    >
      -1
    </button>
  </view>
</template>

<style scoped>
.issue312-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #fff;
}

.issue312-title,
.issue312-current,
.issue312-index {
  display: block;
  margin-bottom: 12rpx;
  color: #0f172a;
}

.issue312-title {
  font-size: 30rpx;
  font-weight: 700;
}

.issue312-current,
.issue312-index {
  font-size: 24rpx;
}

.issue312-btn {
  margin-top: 12rpx;
}
</style>
