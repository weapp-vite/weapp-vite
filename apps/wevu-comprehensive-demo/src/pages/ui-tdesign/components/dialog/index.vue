<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignDialogPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-dialog',
}))

const visible = ref(false)
function open() { visible.value = true }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-dialog
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" @click="open">
        打开
      </t-button>
      <t-dialog :visible="visible" header="t-dialog" content="content" @close="visible = false" />
    </view>
  </view>
</template>
