<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantActionSheetPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-action-sheet',
}))

const show = ref(false)
const actions = ref([{ name: '选项 A' }, { name: '选项 B' }])
function open() { show.value = true }
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-action-sheet
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-button size="small" @click="open">
          打开
        </van-button>
        <van-action-sheet :show="show" :actions="actions" @close="show = false" />
      </view>
    </view>
  </van-config-provider>
</template>
