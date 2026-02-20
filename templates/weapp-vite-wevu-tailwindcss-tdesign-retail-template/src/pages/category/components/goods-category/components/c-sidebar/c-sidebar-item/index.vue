<script lang="ts">
Component({
  relations: {
    '../../c-sidebar/index': {
      type: 'ancestor',
      linked(target) {
        this.parent = target;
      },
    },
  },

  externalClasses: ['custom-class'],
  properties: {
    title: String,
    disabled: Boolean,
  },

  data: {
    topRightRadius: false,
    bottomRightRadius: false,
  },

  methods: {
    setActive(selected) {
      return this.setData({ selected });
    },
    onClick() {
      const { parent } = this;

      if (!parent || this.properties.disabled) {
        return;
      }

      const index = parent.children.indexOf(this);

      parent.setActive(index).then(() => {
        this.triggerEvent('click', index);
        parent.triggerEvent('change', { index });
      });
    },
    setTopRightRadius(val) {
      return this.setData({
        topRightRadius: val,
      });
    },
    setBottomRightRadius(val) {
      return this.setData({
        bottomRightRadius: val,
      });
    },
  },
});
</script>

<template>
<view class="c-sidebar-item-container [background-color:white]">
  <view
    class="c-sidebar-item {{ selected ? 'active' : '' }} {{ disabled ? 'disabled' : '' }} {{topRightRadius ? 'top-right-radius' : ''}} {{bottomRightRadius ? 'bottom-right-radius' : ''}} custom-class [display:flex] [justify-content:center] [text-align:center] [background-color:#f5f5f5] [color:#222427] [padding:20rpx_0] [font-size:26rpx] [&_.active]:[position:relative] [&_.active]:[background:white] [&_.active_.c-sidebar-item__text]:[background-color:white] [&_.active_.c-sidebar-item__text]:[border-radius:36rpx] [&_.active_.c-sidebar-item__text]:[color:#fa4126] [border-top-right-radius:16rpx] [border-bottom-right-radius:16rpx]"
    hover-class="c-sidebar-item--hover"
    hover-stay-time="70"
    bind:tap="onClick"
  >
    <view class="c-sidebar-item__text text-overflow [width:136rpx] [height:36rpx] [padding:8rpx_0] [line-height:36rpx] [text-align:center] [font-size:28rpx] [color:#666666] [overflow:hidden] [text-overflow:ellipsis] [white-space:nowrap]"> {{ title }} </view>
  </view>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {}
}
</json>
