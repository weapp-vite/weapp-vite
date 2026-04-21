<script setup lang="ts">
import { onLoad, onShow, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { getCategoryList } from '../../services/good/fetchCategoryList'

const nativeInstance = useNativeInstance()
const list = ref<any[]>([])

async function init() {
  try {
    const result = await getCategoryList()
    list.value = Array.isArray(result) ? result : []
  }
  catch (error) {
    console.error('err:', error)
  }
}

async function onChange() {
  await wpi.navigateTo({
    url: '/pages/goods/list/index',
  })
}

onShow(() => {
  nativeInstance.getTabBar?.()?.init?.()
})

onLoad(() => {
  void init()
})

defineExpose({
  list,
  onChange,
})

definePageJson({
  navigationBarTitleText: '分类',
  usingComponents: {
    'goods-category': './components/goods-category/index',
  },
})
</script>

<template>
  <view class="wrap h-screen overflow-hidden">
    <goods-category
      :level="3"
      custom-class="goods-category-class ![background-color:#f6f6f6] [height:100%] [&_.goods-category-normal-item-container-item]:[margin-top:20rpx]"
      :category="list"
      @changeCategory="onChange"
    />
  </view>
</template>
