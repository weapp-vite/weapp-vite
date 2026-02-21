<script setup lang="ts">
defineOptions({
  externalClasses: ['custom-class'],
  properties: {
    category: {
      type: Array
    },
    initActive: {
      type: Array,
      value: [],
      observer(newVal, oldVal) {
        if (newVal[0] !== oldVal[0]) {
          this.setActiveKey(newVal[0], 0);
        }
      }
    },
    isSlotRight: {
      type: Boolean,
      value: false
    },
    level: {
      type: Number,
      value: 3
    }
  },
  data() {
    return {
      activeKey: 0,
      subActiveKey: 0
    };
  },
  attached() {
    if (this.properties.initActive && this.properties.initActive.length > 0) {
      this.setData({
        activeKey: this.properties.initActive[0],
        subActiveKey: this.properties.initActive[1] || 0
      });
    }
  },
  methods: {
    onParentChange(event) {
      this.setActiveKey(event.detail.index, 0).then(() => {
        this.triggerEvent('change', [this.data.activeKey, this.data.subActiveKey]);
      });
    },
    onChildChange(event) {
      this.setActiveKey(this.data.activeKey, event.detail.index).then(() => {
        this.triggerEvent('change', [this.data.activeKey, this.data.subActiveKey]);
      });
    },
    changCategory(event) {
      const {
        item
      } = event.currentTarget.dataset;
      this.triggerEvent('changeCategory', {
        item
      });
    },
    setActiveKey(key, subKey) {
      return new Promise(resolve => {
        this.setData({
          activeKey: key,
          subActiveKey: subKey
        }, () => {
          resolve();
        });
      });
    }
  }
});
</script>

<template>
<view class="goods-category custom-class [display:flex] [&_.custom-sidebar]:[background-color:#f5f5f5]">
  <c-sidebar custom-class="custom-sidebar [height:100%] [width:180rpx] [height:100vh]" bindchange="onParentChange" activeKey="{{activeKey}}">
    <c-sidebar-item wx:for="{{ category }}" wx:key="index" title="{{ item.name }}" disabled="{{ item.disabled }}" />
  </c-sidebar>
  <view class="goods-category__right [height:100%] [flex:auto] [width:0] [position:relative] [overflow:scroll] [-webkit-overflow-scrolling:touch] [background-color:white] [display:flex]">
    <c-tabbar wx:if="{{isSlotRight}}" activeKey="{{subActiveKey}}" bindchange="onChildChange" showMore>
      <slot />
    </c-tabbar>
    <view wx:if="{{!isSlotRight}}" class="goods-category-normal [margin:28rpx_34rpx_0rpx_32rpx]">
      <view
        class="goods-category-normal-item"
        wx:if="{{category[activeKey].children && category[activeKey].children.length > 0}}"
      >
        <block
          wx:for="{{category[activeKey].children}}"
          wx:key="index"
          wx:if="{{level === 3 && item.children && item.children.length > 0}}"
        >
          <view class="flex goods-category-normal-item-title [display:flex] [font-size:28rpx] [font-weight:500]"> {{item.name}} </view>
          <view class="goods-category-normal-item-container [background-color:#fff] [border-radius:8rpx] [padding-top:28rpx] [margin-top:-24rpx] [margin-bottom:30rpx] [display:flex] [flex-wrap:wrap]">
            <view
              class="goods-category-normal-item-container-item [height:196rpx] [display:flex] [flex-direction:column] [align-items:center] [margin-top:24rpx] [width:33.3%] [&_.image]:[width:144rpx] [&_.image]:[height:144rpx]"
              wx:for="{{item.children}}"
              wx:for-index="subIndex"
              wx:key="subIndex"
              wx:for-item="subItem"
              bindtap="changCategory"
              data-item="{{subItem}}"
            >
              <t-image src="{{subItem.thumbnail}}" t-class="image" />
              <view class="flex goods-category-normal-item-container-item-title [display:flex] [justify-content:center] [font-size:24rpx] [color:#666666] [margin-top:20rpx]"> {{subItem.name}} </view>
            </view>
          </view>
        </block>
        <view class="goods-category-normal-item-second-container [background-color:#fff] [border-radius:8rpx] [margin-top:8rpx] [margin-bottom:30rpx] [display:grid] [grid-template-columns:33.33%_33.33%_33.33%]" wx:if="{{level === 2}}">
          <block wx:for="{{category[activeKey].children}}" wx:key="index">
            <view
              class="goods-category-normal-item-second-container-item [height:200rpx] [text-align:center] [margin-top:20rpx] [&_.image]:[width:144rpx] [&_.image]:[height:144rpx]"
              wx:for-key="index"
              bindtap="changCategory"
              data-item="{{item}}"
            >
              <t-image src="{{item.thumbnail}}" t-class="image" />
              <view class="flex goods-category-normal-item-container-item-title [display:flex] [justify-content:center] [font-size:24rpx] [color:#666666] [margin-top:20rpx]"> {{item.name}} </view>
            </view>
          </block>
        </view>
      </view>
    </view>
  </view>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "c-tabbar": "./components/c-tabbar/index",
    "c-sidebar": "./components/c-sidebar/index",
    "c-sidebar-item": "./components/c-sidebar/c-sidebar-item/index",
    "t-image": "/components/webp-image/index"
  }
}
</json>
