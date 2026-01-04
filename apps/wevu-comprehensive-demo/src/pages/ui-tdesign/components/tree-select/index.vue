<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiTDesignTreeSelectPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'TDesign / t-tree-select',
}))

const value = ref(0)
const options = ref([{ label: '分组 1', value: 0, children: [{ label: '选项 1', value: 0 }, { label: '选项 2', value: 1 }] }, { label: '分组 2', value: 1, children: [{ label: '选项 3', value: 2 }, { label: '选项 4', value: 3 }] }])
</script>

<template>
  <view class="container">
    <view class="page-title">
      t-tree-select
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <t-tree-select :options="options" :value="value" />
    </view>
  </view>
</template>

