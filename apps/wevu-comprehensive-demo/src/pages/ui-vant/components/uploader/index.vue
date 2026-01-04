<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantUploaderPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-uploader',
}))

const fileList = ref([{ url: 'https://dummyimage.com/120x120/667eea/ffffff.png&text=WeVu', name: 'demo.png', isImage: true }])
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-uploader
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-uploader :file-list="fileList" />
    </view>
  </view>
</van-config-provider>
</template>

