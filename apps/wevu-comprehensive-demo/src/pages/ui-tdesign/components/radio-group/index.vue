<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignRadioGroupPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-radio-group',
}))

const value = ref('1')
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-radio-group
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-radio-group :value="value">
        <t-radio value="1">1</t-radio>
        <t-radio value="2">2</t-radio>
      </t-radio-group>
    </view>
  </view>
</template>

