<script setup lang="ts">
// pages/goods/comments/components/comments-card/images-videos/index.js
defineOptions({
  /**
   * 组件的属性列表
   */
  properties: {
    resources: {
      type: Array,
      value: []
    }
  },
  data() {
    return {
      classType: 'single'
    };
  },
  observers: {
    resources: function (newVal) {
      if (newVal.length <= 1) {
        this.setData({
          classType: 'single'
        });
      } else if (newVal.length === 2) {
        this.setData({
          classType: 'double'
        });
      } else {
        this.setData({
          classType: 'multiple'
        });
      }
    }
  },
  /**
   * 组件的方法列表
   */
  methods: {}
});
</script>

<template>
<view class="images-videos-container container-{{classType}} [display:flex] [flex-wrap:wrap]">
	<view
	  class="resource-container resource-container-{{classType}} [display:flex]"
	  wx:for="{{resources}}"
	  wx:for-item="resource"
	  wx:key="*this"
	>
		<t-image wx:if="{{resource.type === 'image'}}" t-class="resource-item-{{classType}}" src="{{resource.src}}" />
		<my-video wx:else videoSrc="{{resource.src}} " my-video="resource-item-{{classType}}">
			<t-image t-class="resource-item resource-item-{{classType}}" slot="cover-img" src="{{resource.coverSrc}}" />
			<image class="play-icon [width:96rpx] [height:96rpx]" slot="play-icon" src="./assets/play.png" />
		</my-video>
	</view>
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "my-video": "../my-video/index",
    "t-image": "/components/webp-image/index"
  }
}</json>
