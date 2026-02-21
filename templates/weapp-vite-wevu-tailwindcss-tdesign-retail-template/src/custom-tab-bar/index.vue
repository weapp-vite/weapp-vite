<script setup lang="ts">
import TabMenu from './data';
defineOptions({
  data() {
    return {
      active: 0,
      list: TabMenu
    };
  },
  methods: {
    onChange(event) {
      this.setData({
        active: event.detail.value
      });
      wx.switchTab({
        url: this.data.list[event.detail.value].url.startsWith('/') ? this.data.list[event.detail.value].url : `/${this.data.list[event.detail.value].url}`
      });
    },
    init() {
      const page = getCurrentPages().pop();
      const route = page ? page.route.split('?')[0] : '';
      const active = this.data.list.findIndex(item => (item.url.startsWith('/') ? item.url.substr(1) : item.url) === `${route}`);
      this.setData({
        active
      });
    }
  }
});
</script>

<template>
<t-tab-bar
 value="{{active}}"
 bindchange="onChange"
 split="{{false}}"
>
	<t-tab-bar-item
	 wx:for="{{list}}"
	 wx:for-item="item"
	 wx:for-index="index"
	 wx:key="index"
	>
		<view class="custom-tab-bar-wrapper [display:flex] [flex-direction:column] [align-items:center] [&_.text]:[font-size:20rpx]">
			<t-icon prefix="wr" name="{{item.icon}}" size="48rpx" />
			<view class="text">{{ item.text }}</view>
		</view>
	</t-tab-bar-item>
</t-tab-bar>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-tab-bar": "tdesign-miniprogram/tab-bar/tab-bar",
    "t-tab-bar-item": "tdesign-miniprogram/tab-bar-item/tab-bar-item",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
