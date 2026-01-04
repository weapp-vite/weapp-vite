<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignCollapsePanelPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-collapse-panel',
}))

const value = ref([0])
function onChange(event) { value.value = event.detail }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-collapse-panel
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-collapse :value="value" @change="onChange">
        <t-collapse-panel header="Panel 1" value="0">content</t-collapse-panel>
        <t-collapse-panel header="Panel 2" value="1">content</t-collapse-panel>
      </t-collapse>
    </view>
  </view>
</template>

