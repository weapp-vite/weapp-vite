<script setup lang="ts">
import { getCategoryList } from '../../services/good/fetchCategoryList';
import { onLoad, onShow, ref, useNativeInstance } from 'wevu';

const nativeInstance = useNativeInstance() as any;
const list = ref<any[]>([]);

async function init() {
  try {
    const result = await getCategoryList();
    list.value = Array.isArray(result) ? result : [];
  }
  catch (error) {
    console.error('err:', error);
  }
}

function onChange() {
  wx.navigateTo({
    url: '/pages/goods/list/index',
  });
}

onShow(() => {
  nativeInstance.getTabBar?.()?.init?.();
});

onLoad(() => {
  void init();
});

defineExpose({
  list,
  onChange,
});
</script>

<template>
<view class="wrap [height:100vh] [overflow:hidden]">
  <goods-category
    level="{{3}}"
    custom-class="goods-category-class ![background-color:#f6f6f6] [height:100%] [&_.goods-category-normal-item-container-item]:[margin-top:20rpx]"
    category="{{list}}"
    bind:changeCategory="onChange"
  />
</view>
</template>

<json>
{
  "navigationBarTitleText": "分类",
  "usingComponents": {
    "goods-category": "./components/goods-category/index"
  }
}
</json>
