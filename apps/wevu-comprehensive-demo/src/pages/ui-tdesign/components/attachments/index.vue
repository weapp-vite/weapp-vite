<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignAttachmentsPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-attachments',
}))

const items = ref([{ name: 'demo.png', url: 'https://dummyimage.com/120x120/667eea/ffffff.png&text=TDesign', size: 2048 }, { name: 'demo.pdf', url: 'https://example.com/demo.pdf', size: 1024 * 1024 }])
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-attachments
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-attachments :items="items" />
    </view>
  </view>
</template>

