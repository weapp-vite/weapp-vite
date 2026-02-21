<script setup lang="ts">
defineOptions({
  externalClasses: ['t-class', 't-class-load'],
  properties: {
    loadFailed: {
      type: String,
      value: 'default'
    },
    loading: {
      type: String,
      value: 'default'
    },
    src: {
      type: String,
      value: ''
    },
    mode: {
      type: String,
      value: 'aspectFill'
    },
    webp: {
      type: Boolean,
      value: true
    },
    lazyLoad: {
      type: Boolean,
      value: false
    },
    showMenuByLongpress: {
      type: Boolean,
      value: false
    }
  },
  data() {
    return {
      thumbHeight: 375,
      thumbWidth: 375,
      systemInfo: wx.getSystemInfoSync()
    };
  },
  lifetimes: {
    ready() {
      const {
        mode
      } = this.properties;
      // 获取容器的真实宽高，设置图片的裁剪宽度
      this.getRect('.J-image').then(res => {
        if (res) {
          const {
            width,
            height
          } = res;
          this.setData(mode === 'heightFix' ? {
            thumbHeight: this.px2rpx(height) || 375
          } : {
            thumbWidth: this.px2rpx(width) || 375
          });
        }
      });
    }
  },
  methods: {
    px2rpx(px) {
      return 750 / ((this.data.systemInfo?.screenWidth) || 375) * px;
    },
    getRect(selector) {
      return new Promise(resolve => {
        if (!this.selectorQuery) {
          this.selectorQuery = this.createSelectorQuery();
        }
        this.selectorQuery.select(selector).boundingClientRect(resolve).exec();
      });
    },
    onLoad(e) {
      this.triggerEvent('load', e.detail);
    },
    onError(e) {
      this.triggerEvent('error', e.detail);
    }
  }
});
</script>

<template>
<wxs src="./utils.wxs" module="Utils" />
<t-image
  class="J-image"
  src="{{Utils.getSrc({src, thumbWidth: thumbWidth || 0, thumbHeight: thumbHeight || 0, systemInfo, webp, mode})}}"
  t-class="t-class"
  t-class-load="t-class-load"
  mode="{{ mode }}"
  lazy="{{ lazyLoad }}"
  show-menu-by-longpress="{{showMenuByLongpress}}"
  error="{{loadFailed}}"
  loading="{{loading}}"
  binderror="onError"
  bindload="onLoad"
/>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-image": "tdesign-miniprogram/image/image"
  }
}</json>
