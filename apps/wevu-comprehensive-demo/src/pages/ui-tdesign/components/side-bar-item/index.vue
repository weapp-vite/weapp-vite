<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignSideBarItemPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-side-bar-item',
}))

const value = ref(0)
function onChange(event) { value.value = event.detail }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-side-bar-item
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-side-bar :value="value" @change="onChange">
        <t-side-bar-item label="侧边 1" />
        <t-side-bar-item label="侧边 2" />
      </t-side-bar>
    </view>
  </view>
</template>

