<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class'],
  options: {
    multipleSlots: true
  },
  properties: {
    disabled: Boolean,
    leftWidth: {
      type: Number,
      value: 0
    },
    rightWidth: {
      type: Number,
      value: 0
    },
    asyncClose: Boolean
  },
  attached() {
    const instances = (globalThis.__WEVU_SWIPEOUT_INSTANCES__ ||= []);
    instances.push(this);
  },
  detached() {
    const instances = (globalThis.__WEVU_SWIPEOUT_INSTANCES__ ||= []);
    globalThis.__WEVU_SWIPEOUT_INSTANCES__ = instances.filter(item => item !== this);
  },
  data() {
    return {
      wrapperStyle: '',
      asyncClose: false,
      closed: true
    };
  },
  /**
   * Component methods
   */
  methods: {
    open(position) {
      this.setData({
        closed: false
      });
      this.triggerEvent('close', {
        position,
        instance: this
      });
    },
    close() {
      this.setData({
        closed: true
      });
    },
    closeOther() {
      const instances = (globalThis.__WEVU_SWIPEOUT_INSTANCES__ ||= []);
      instances.filter(item => item !== this).forEach(item => item.close());
    },
    noop() {
      return;
    },
    onClick(event) {
      const {
        key: position = 'outside'
      } = event.currentTarget.dataset;
      this.triggerEvent('click', position);
      if (this.data.closed) {
        return;
      }
      if (this.data.asyncClose) {
        this.triggerEvent('close', {
          position,
          instance: this
        });
      } else {
        this.close();
      }
    }
  }
});
</script>

<template>
<wxs src="./swipe.wxs" module="swipe"></wxs>

<view
  class="wr-class wr-swipeout [position:relative] [overflow:hidden]"
  data-key="cell"
  capture-bind:tap="onClick"
  bindtouchstart="{{disabled || swipe.startDrag}}"
  capture-bind:touchmove="{{disabled || swipe.onDrag}}"
  bindtouchend="{{disabled || swipe.endDrag}}"
  bindtouchcancel="{{disabled || swipe.endDrag}}"
  closed="{{closed}}"
  change:closed="{{swipe.onCloseChange}}"
  leftWidth="{{leftWidth}}"
  rightWidth="{{rightWidth}}"
  change:leftWidth="{{swipe.initLeftWidth}}"
  change:rightWidth="{{swipe.initRightWidth}}"
>
  <view id="wrapper">
    <view wx:if="{{ leftWidth }}" class="wr-swipeout__left [position:absolute] [top:0] [height:100%] [left:0] [transform:translate3d(-100%,_0,_0)]" data-key="left" catch:tap="onClick">
      <slot name="left" />
    </view>
    <slot />
    <view wx:if="{{ rightWidth }}" class="wr-swipeout__right [position:absolute] [top:0] [height:100%] [right:0] [transform:translate3d(100%,_0,_0)]" data-key="right" catch:tap="onClick">
      <slot name="right" />
    </view>
  </view>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {}
}
</json>
