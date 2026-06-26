<script setup lang="ts">
import { useRootImportHmr } from '../../shared/root-import-hmr'

definePageJson({
  navigationBarTitleText: 'Root Import HMR',
})

const { label } = useRootImportHmr()
</script>

<template>
  <view class="root-import-hmr">
    {{ label }}
  </view>
</template>

<style>
.root-import-hmr {
  padding: 24rpx;
}
</style>
