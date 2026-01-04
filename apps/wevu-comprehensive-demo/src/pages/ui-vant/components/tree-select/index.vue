<script setup lang="ts">
import { ref } from 'wevu'

defineOptions({
  name: 'UiVantTreeSelectPage',
})

definePageJson(() => ({
  navigationBarTitleText: 'Vant / van-tree-select',
}))

const mainActiveIndex = ref(0)
const activeId = ref(0)
const items = ref([{ text: '分组 1', children: [{ text: '选项 1', id: 0 }, { text: '选项 2', id: 1 }] }, { text: '分组 2', children: [{ text: '选项 3', id: 2 }, { text: '选项 4', id: 3 }] }])
</script>

<template>
<van-config-provider>
  <view class="container">
    <view class="page-title">
      van-tree-select
    </view>

    <view class="section">
      <view class="section-title">
        各种用法
      </view>
      <van-tree-select :items="items" :main-active-index="mainActiveIndex" :active-id="activeId" />
    </view>
  </view>
</van-config-provider>
</template>

