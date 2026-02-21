<script setup lang="ts">
defineOptions({
  externalClasses: ['custom-class'],
  properties: {
    activeKey: {
      type: Number,
      value: 0
    },
    tabList: {
      type: Array,
      value: []
    },
    showMore: Boolean // 是否需要下拉功能
  },
  observers: {
    activeKey(newVal) {
      if (this.properties.tabList && newVal) {
        this.setActive(newVal).catch(e => {
          console.error(e);
        });
      }
    }
  },
  data() {
    return {
      currentActive: -1
    };
  },
  attached() {
    this.setActive(this.properties.activeKey).catch(e => {
      console.error(e);
    });
  },
  methods: {
    setActive(activeKey) {
      if (!this.properties.tabList[activeKey] || this.properties.tabList[activeKey].disabled) {
        return Promise.reject('数据异常或不可操作');
      }
      return new Promise(resolve => {
        this.setData({
          currentActive: activeKey
        }, () => resolve());
      });
    },
    onClick(event) {
      let activeKey;
      if (event.type === 'select') {
        activeKey = event.detail;
      } else {
        activeKey = event.currentTarget.dataset.index;
      }
      this.setActive(activeKey).then(() => {
        const {
          currentActive
        } = this.data;
        this.triggerEvent('change', {
          index: currentActive
        });
      }).catch(e => {
        console.error(e);
      });
    }
  }
});
</script>

<template>
<view class="c-tabbar custom-class [width:100%] [height:100%] [position:relative] [--tabbar-height:100rpx] [--tabbar-fontsize:28rpx] [--tabbar-background-color:white]">
  <scroll-view
    wx:if="{{ tabList.length > 0 }}"
    class="c-tabbar__scroll [position:relative]"
    scroll-x="true"
    scroll-into-view="{{ 'id-' + currentActive }}"
  >
    <view class="c-tabbar__inner {{showMore && tabList.length > 4 ? 'c-tabbar__inner_more' : ''}} [display:flex] [flex-flow:row_nowrap]">
      <view
        wx:for="{{ tabList }}"
        wx:key="index"
        id="{{ 'id-' + index }}"
        class="c-tabbar-item {{ currentActive === index ? 'active' : '' }} {{ item.disabled ? 'disabled' : '' }} [flex:none] [height:100rpx] [color:#282828] [font-size:28rpx] [padding:0_20rpx] [&_.disabled]:[color:#ccc]"
        bind:tap="onClick"
        data-index="{{index}}"
      >
        <view class="c-tabbar-item__text [width:100%] [text-align:center] [height:100rpx] [line-height:100rpx]"> {{ item.name }} </view>
      </view>
    </view>
  </scroll-view>
  <c-tabbar-more wx:if="{{ showMore && tabList.length > 4 }}" tabList="{{tabList}}" bindselect="onClick" />
  <slot />
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "c-tabbar-more": "./c-tabbar-more/index"
  }
}
</json>
