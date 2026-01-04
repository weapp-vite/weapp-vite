<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignSkeletonPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-skeleton',
}))

const rowCol = ref([{ width: '60%' }, { width: '40%' }])
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-skeleton
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-skeleton :row-col="rowCol" />
    </view>
  </view>
</template>

