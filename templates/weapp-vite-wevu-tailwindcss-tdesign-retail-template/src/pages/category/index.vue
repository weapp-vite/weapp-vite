<script setup lang="ts">
import { getCategoryList } from '../../services/good/fetchCategoryList';
defineOptions({
  data() {
    return {
      list: []
    };
  },
  async init() {
    try {
      const result = await getCategoryList();
      this.setData({
        list: result
      });
    } catch (error) {
      console.error('err:', error);
    }
  },
  onShow() {
    this.getTabBar().init();
  },
  onChange() {
    wx.navigateTo({
      url: '/pages/goods/list/index'
    });
  },
  onLoad() {
    this.init(true);
  }
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
