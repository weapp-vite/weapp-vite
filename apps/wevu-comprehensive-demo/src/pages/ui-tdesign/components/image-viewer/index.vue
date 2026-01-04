<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignImageViewerPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-image-viewer',
}))

const visible = ref(false)
const images = ref(['https://dummyimage.com/300x200/4facfe/ffffff.png&text=1', 'https://dummyimage.com/300x200/764ba2/ffffff.png&text=2'])
function open() { visible.value = true }
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-image-viewer
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-button size="small" @click="open">
        打开
      </t-button>
      <t-image-viewer :visible="visible" :images="images" @close="visible = false" />
    </view>
  </view>
</template>
