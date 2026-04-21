<script setup lang="ts">
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { rejectAddress, resolveAddress } from '../../../../services/address/list'
import { addressParse } from '../../../../utils/addressParse'
import { getPermission } from '../../../../utils/getPermission'
import { phoneRegCheck } from '../../../../utils/util'

defineOptions({
  externalClasses: ['t-class'],
  properties: {
    title: {
      type: String,
    },
    navigateUrl: {
      type: String,
    },
    navigateEvent: {
      type: String,
    },
    isCustomStyle: {
      type: Boolean,
      value: false,
    },
    isDisabledBtn: {
      type: Boolean,
      value: false,
    },
    isOrderSure: {
      type: Boolean,
      value: false,
    },
  },
  methods: {
    getWxLocation() {
      if (this.properties.isDisabledBtn) { return }
      getPermission({
        code: 'scope.address',
        name: '通讯地址',
      }).then(async () => {
        try {
          const options = await wpi.chooseAddress()
          const {
            provinceName,
            cityName,
            countyName,
            detailInfo,
            userName,
            telNumber,
          } = options
          if (!phoneRegCheck(telNumber)) {
            showToast({
              context: this,
              message: '请填写正确的手机号',
            })
            return
          }
          const target = {
            name: userName,
            phone: telNumber,
            countryName: '中国',
            countryCode: 'chn',
            detailAddress: detailInfo,
            provinceName,
            cityName,
            districtName: countyName,
            isDefault: false,
            isOrderSure: this.properties.isOrderSure,
          }
          try {
            const {
              provinceCode,
              cityCode,
              districtCode,
            } = await addressParse(provinceName, cityName, countyName)
            const params = Object.assign(target, {
              provinceCode,
              cityCode,
              districtCode,
            })
            if (this.properties.isOrderSure) {
              this.onHandleSubmit(params)
            }
            else if (this.properties.navigateUrl != '') {
              const {
                navigateEvent,
              } = this.properties
              this.triggerEvent('navigate')
              await wpi.navigateTo({
                url: this.properties.navigateUrl,
                success(res) {
                  res.eventChannel.emit(navigateEvent, params)
                },
              })
            }
            else {
              this.triggerEvent('change', params)
            }
          }
          catch (error) {
            showToast({
              title: '地址解析出错，请稍后再试',
              icon: 'none',
            })
          }
        }
        catch (err) {
          console.warn('未选择微信收货地址', err)
        }
      })
    },
    findPage(pageRouteUrl) {
      const currentRoutes = getCurrentPages().map(v => v.route)
      return currentRoutes.indexOf(pageRouteUrl)
    },
    async onHandleSubmit(params) {
      try {
        const orderPageDeltaNum = this.findPage('pages/order/order-confirm/index')
        if (orderPageDeltaNum > -1) {
          await wpi.navigateBack({
            delta: 1,
          })
          resolveAddress(params)
        }
      }
      catch (err) {
        rejectAddress()
        console.error(err)
      }
    },
  },
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view class="wx-address t-class [&_.weixin]:inline-block [&_.weixin]:text-[48rpx] [&_.weixin]:mr-[20rpx] [&_.weixin]:[font-weight:normal] [&_.cell]:p-[32rpx_30rpx] [&_.cell]:rounded-[8rpx] [&_.cell__title]:text-[30rpx] [&_.cell__title]:text-[#333333]" @tap="getWxLocation">
    <block v-if="isCustomStyle">
      <view class="wx-address-custom flex items-center text-[32rpx]">
        <t-icon prefix="wr" t-class="weixin" color="#0ABF5B" name="wechat" size="48rpx" />
        <text>{{ title }}</text>
      </view>
      <slot />
    </block>
    <block v-else>
      <t-cell :title="title" title-class="cell__title" wr-class="cell" :border="false">
        <template #icon>
          <t-icon t-class="weixin"color="#0ABF5B" name="logo-windows" size="48rpx" />
        </template>
        <template #right-icon>
          <t-icon name="chevron-right" class="custom-icon" color="#bbb" />
        </template>
      </t-cell>
    </block>
  </view>
</template>
