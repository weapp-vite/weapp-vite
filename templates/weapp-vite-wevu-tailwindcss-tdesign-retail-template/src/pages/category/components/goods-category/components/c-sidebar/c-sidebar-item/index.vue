<script setup lang="ts">
defineOptions({
  relations: {
    '../../c-sidebar/index': {
      type: 'ancestor',
      linked(this: any, target: any) {
        this.parent = target
      },
    },
  },
  externalClasses: ['custom-class'],
  properties: {
    title: String,
    disabled: Boolean,
  },
  data() {
    return {
      topRightRadius: false,
      bottomRightRadius: false,
    }
  },
  methods: {
    setActive(this: any, selected: boolean) {
      return this.setData({
        selected,
      })
    },
    onClick(this: any) {
      const {
        parent,
      } = this
      if (!parent || this.properties.disabled) {
        return
      }
      const index = parent.children.indexOf(this)
      parent.setActive(index).then(() => {
        this.triggerEvent('click', index)
        parent.triggerEvent('change', {
          index,
        })
      })
    },
    setTopRightRadius(this: any, val: boolean) {
      return this.setData({
        topRightRadius: val,
      })
    },
    setBottomRightRadius(this: any, val: boolean) {
      return this.setData({
        bottomRightRadius: val,
      })
    },
  },
} as any)

defineComponentJson({
  component: true,
  usingComponents: {},
})
</script>

<template>
  <view class="c-sidebar-item-container bg-[white]">
    <view
      :class="`c-sidebar-item ${selected ? 'active' : ''} ${disabled ? 'disabled' : ''} ${topRightRadius ? 'top-right-radius' : ''} ${bottomRightRadius ? 'bottom-right-radius' : ''} custom-class flex justify-center text-center bg-[#f5f5f5] text-[#222427] p-[20rpx_0] text-[26rpx] [&_.active]:relative [&_.active]:[background:white] [&_.active_.c-sidebar-item__text]:bg-[white] [&_.active_.c-sidebar-item__text]:rounded-[36rpx] [&_.active_.c-sidebar-item__text]:text-[#fa4126] rounded-r-[16rpx]`"
      hover-class="c-sidebar-item--hover"
      :hover-stay-time="70"
      @tap="onClick"
    >
      <view class="c-sidebar-item__text text-overflow w-[136rpx] h-[36rpx] p-[8rpx_0] leading-[36rpx] text-center text-[28rpx] text-[#666666] truncate">
        {{ title }}
      </view>
    </view>
  </view>
</template>
