<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantCascaderPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-cascader',
}))

const show = ref(true)
const options = ref([{ text: '浙江', value: 'zj', children: [{ text: '杭州', value: 'hz' }, { text: '宁波', value: 'nb' }] }, { text: '江苏', value: 'js', children: [{ text: '南京', value: 'nj' }, { text: '苏州', value: 'sz' }] }])
</script>

<template>
  <van-config-provider>
    <view class="container">
      <view class="page-title">
        van-cascader
      </view>

      <view class="section">
        <view class="section-title">
          各种用法
        </view>
        <van-cascader :show="show" :options="options" />
      </view>
    </view>
  </van-config-provider>
</template>
