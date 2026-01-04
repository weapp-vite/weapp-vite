<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignCheckboxPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-checkbox',
}))

const value = ref(['a'])
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-checkbox
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-checkbox-group :value="value">
        <t-checkbox value="a">
          A
        </t-checkbox>
        <t-checkbox value="b">
          B
        </t-checkbox>
      </t-checkbox-group>
    </view>
  </view>
</template>
