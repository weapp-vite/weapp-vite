<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignTabsPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-tabs',
}))

const tabsValue = ref('tab-1')
function onTabsChange(event) { tabsValue.value = event.detail?.value ?? event.detail }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-tabs
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-tabs :value="tabsValue" @change="onTabsChange">
        <t-tab-panel value="tab-1" label="Tab 1">
          tab-1
        </t-tab-panel>
        <t-tab-panel value="tab-2" label="Tab 2">
          tab-2
        </t-tab-panel>
      </t-tabs>
    </view>
  </view>
</template>
