<script setup lang="ts">
defineOptions({
  name: 'UiTDesignButtonPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-button',
}))
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-button
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button theme="primary" size="small">
        primary
      </t-button>
      <t-button variant="outline" size="small">
        outline
      </t-button>
      <t-button theme="danger" size="small">
        danger
      </t-button>
    </view>
  </view>
</template>
