<script setup lang="ts">
import { getCurrentInstance } from 'wevu'
import LoopSlotCell from '../../components/issue-554/LoopSlotCell/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-554',
})

const items = [
  {
    key: 'cover-a',
    src: '/assets/images/home/goods-1.png',
  },
]
const mpContext = getCurrentInstance()

function _runE2E() {
  const nativeData = (mpContext as any)?.data ?? {}
  const slotMetadata = nativeData.__wv_bind_0

  return {
    itemCount: items.length,
    ok: true,
    expected: items[0]?.src,
    runtimeItems: nativeData.items,
    slotMetadata,
  }
}
</script>

<template>
  <view class="issue554-page">
    <view class="issue554-title">
      issue-554 loop slot metadata
    </view>

    <LoopSlotCell
      v-for="{ key, src } in items"
      :key="key"
    >
      <image
        class="issue554-image"
        :src="src"
        mode="aspectFit"
      />
    </LoopSlotCell>
  </view>
</template>

<style scoped>
.issue554-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 28rpx;
  background: #fff;
}

.issue554-title {
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #111827;
}

.issue554-image {
  width: 160rpx;
  height: 120rpx;
}
</style>
