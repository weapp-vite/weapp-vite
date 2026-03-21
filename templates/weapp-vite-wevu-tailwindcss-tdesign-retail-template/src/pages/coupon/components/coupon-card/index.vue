<script setup lang="ts">
defineOptions({
  options: {
    addGlobalClass: true,
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },
  externalClasses: ['coupon-class'],
  properties: {
    couponDTO: {
      type: Object,
      value: {}, // 优惠券数据
    },
  },
  data() {
    return {
      btnText: '',
      btnTheme: '',
    }
  },
  observers: {
    couponDTO(couponDTO) {
      if (!couponDTO) {
        return
      }
      const statusMap = {
        default: {
          text: '去使用',
          theme: 'primary',
        },
        useless: {
          text: '已使用',
          theme: 'default',
        },
        disabled: {
          text: '已过期',
          theme: 'default',
        },
      }
      const statusInfo = statusMap[couponDTO.status]
      this.setData({
        btnText: statusInfo.text,
        btnTheme: statusInfo.theme,
      })
    },
  },
  attached() {},
  methods: {
    // 跳转到详情页
    gotoDetail() {
      wx.navigateTo({
        url: `/pages/coupon/coupon-detail/index?id=${this.data.couponDTO.key}`,
      })
    },
    // 跳转到商品列表
    gotoGoodsList() {
      wx.navigateTo({
        url: `/pages/coupon/coupon-activity-goods/index?id=${this.data.couponDTO.key}`,
      })
    },
  },
})

defineComponentJson({
  component: true,
  usingComponents: {
    'ui-coupon-card': '/components/promotion/ui-coupon-card/index',
    't-button': 'tdesign-miniprogram/button/button',
  },
})
</script>

<template>
  <ui-coupon-card
    :title="couponDTO.title || ''"
    :type="couponDTO.type || ''"
    :value="couponDTO.value || '0'"
    :tag="couponDTO.tag || ''"
    :desc="couponDTO.desc || ''"
    :currency="couponDTO.currency || ''"
    :timeLimit="couponDTO.timeLimit || ''"
    :status="couponDTO.status || ''"
    @tap="gotoDetail"
  >
    <template #operator>
      <view class="coupon-btn-slot">
        <t-button
          :t-class="`coupon-btn-${btnTheme}`"
          :theme="btnTheme"
          variant="outline"
          shape="round"
          size="extra-small"
          @tap="gotoGoodsList"
        >
          {{ btnText }}
        </t-button>
      </view>
    </template>
  </ui-coupon-card>
</template>
