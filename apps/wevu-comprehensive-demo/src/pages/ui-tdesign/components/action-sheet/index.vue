<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignActionSheetPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-action-sheet',
}))

const visible = ref(false)
const items = ref([{ label: '选项 A', value: 'a' }, { label: '选项 B', value: 'b' }])
function open() { visible.value = true }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-action-sheet
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" @click="open">打开</t-button>
      <t-action-sheet :visible="visible" :items="items" @close="visible = false" />
    </view>
  </view>
</template>

