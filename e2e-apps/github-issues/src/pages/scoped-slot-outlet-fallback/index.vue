<script setup lang="ts">
import BackList from '../../components/scoped-slot-outlet-fallback/BackList/index.vue'

definePageJson({
  navigationBarTitleText: 'scoped-slot-outlet-fallback',
})

function _runE2E() {
  return {
    main: 'scoped slot outlet native main fallback',
    footer: 'scoped slot outlet native footer fallback',
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view class="scoped-slot-outlet-fallback-page">
    <BackList class="scoped-slot-outlet-fallback-card">
      <view slot="main" data-scoped-slot-outlet-fallback="main">
        scoped slot outlet native main fallback
      </view>
      <view slot="footer" data-scoped-slot-outlet-fallback="footer">
        scoped slot outlet native footer fallback
      </view>
    </BackList>
  </view>
</template>

<style>
.scoped-slot-outlet-fallback-page {
  padding: 24rpx;
}

.scoped-slot-outlet-fallback-card {
  color: #0f172a;
}
</style>
