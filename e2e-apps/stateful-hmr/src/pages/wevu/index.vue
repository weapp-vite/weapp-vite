<script setup lang="ts">
import { reactive, ref } from 'wevu'
import { useCounterStore } from '../../shared/store'

definePageJson({
  component: true,
  navigationBarTitleText: 'Wevu Stateful HMR',
})

const marker = 'STATEFUL-WEVU-BASE'
const count = ref(0)
const input = ref('')
const store = useCounterStore()
const storeCount = store.count
const details = reactive<{ removed?: string, added?: string }>({
  removed: 'initial',
})

function increment() {
  count.value += 1
  store.increment(1)
  delete details.removed
}

defineExpose({ increment })
</script>

<template>
  <view class="page">
    <view class="marker">
      {{ marker }}
    </view>
    <view class="count">
      {{ count }}
    </view>
    <view class="store-count">
      {{ storeCount }}
    </view>
    <view v-if="details.removed" class="removed-field">
      {{ details.removed }}
    </view>
    <view v-if="details.added" class="added-field">
      {{ details.added }}
    </view>
    <input v-model="input" class="input">
    <button class="increment" @tap="increment">
      increment
    </button>
  </view>
</template>

<style>
.page {
  padding: 24rpx;
}

.marker,
.count,
.input {
  margin-bottom: 16rpx;
}
</style>
