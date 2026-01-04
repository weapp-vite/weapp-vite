<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantShareSheetPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-share-sheet',
}))

const show = ref(false)
const options = ref([{ name: '微信', icon: 'wechat' }, { name: '复制链接', icon: 'link' }])
function open() { show.value = true }
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-share-sheet
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-button size="small" @click="open">打开</van-button>
      <van-share-sheet :show="show" title="分享" :options="options" @close="show = false" />
    </view>
  </view>
</van-config-provider>
</template>

