<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantStepsPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-steps',
}))

const active = ref(1)
const steps = ref([{ text: 'Step 1', desc: 'desc' }, { text: 'Step 2', desc: 'desc' }, { text: 'Step 3', desc: 'desc' }])
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-steps
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-steps :steps="steps" :active="active" />
    </view>
  </view>
</van-config-provider>
</template>

