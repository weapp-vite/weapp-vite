<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignCascaderPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-cascader',
}))

const options = ref([{ label: '浙江', value: 'zj', children: [{ label: '杭州', value: 'hz' }, { label: '宁波', value: 'nb' }] }, { label: '江苏', value: 'js', children: [{ label: '南京', value: 'nj' }, { label: '苏州', value: 'sz' }] }])
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-cascader
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-cascader :options="options" />
    </view>
  </view>
</template>

