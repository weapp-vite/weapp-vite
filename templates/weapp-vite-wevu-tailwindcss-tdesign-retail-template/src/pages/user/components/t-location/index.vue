<script setup lang="ts">
import { getPermission } from '../../../../utils/getPermission';
import { phoneRegCheck } from '../../../../utils/util';
import Toast from 'tdesign-miniprogram/toast/index';
import { addressParse } from '../../../../utils/addressParse';
import { resolveAddress, rejectAddress } from '../../../../services/address/list';
defineOptions({
  externalClasses: ['t-class'],
  properties: {
    title: {
      type: String
    },
    navigateUrl: {
      type: String
    },
    navigateEvent: {
      type: String
    },
    isCustomStyle: {
      type: Boolean,
      value: false
    },
    isDisabledBtn: {
      type: Boolean,
      value: false
    },
    isOrderSure: {
      type: Boolean,
      value: false
    }
  },
  methods: {
    getWxLocation() {
      if (this.properties.isDisabledBtn) return;
      getPermission({
        code: 'scope.address',
        name: '通讯地址'
      }).then(() => {
        wx.chooseAddress({
          success: async options => {
            const {
              provinceName,
              cityName,
              countyName,
              detailInfo,
              userName,
              telNumber
            } = options;
            if (!phoneRegCheck(telNumber)) {
              Toast({
                context: this,
                selector: '#t-toast',
                message: '请填写正确的手机号'
              });
              return;
            }
            const target = {
              name: userName,
              phone: telNumber,
              countryName: '中国',
              countryCode: 'chn',
              detailAddress: detailInfo,
              provinceName: provinceName,
              cityName: cityName,
              districtName: countyName,
              isDefault: false,
              isOrderSure: this.properties.isOrderSure
            };
            try {
              const {
                provinceCode,
                cityCode,
                districtCode
              } = await addressParse(provinceName, cityName, countyName);
              const params = Object.assign(target, {
                provinceCode,
                cityCode,
                districtCode
              });
              if (this.properties.isOrderSure) {
                this.onHandleSubmit(params);
              } else if (this.properties.navigateUrl != '') {
                const {
                  navigateEvent
                } = this.properties;
                this.triggerEvent('navigate');
                wx.navigateTo({
                  url: this.properties.navigateUrl,
                  success: function (res) {
                    res.eventChannel.emit(navigateEvent, params);
                  }
                });
              } else {
                this.triggerEvent('change', params);
              }
            } catch (error) {
              wx.showToast({
                title: '地址解析出错，请稍后再试',
                icon: 'none'
              });
            }
          },
          fail(err) {
            console.warn('未选择微信收货地址', err);
          }
        });
      });
    },
    async queryAddress(addressId) {
      try {
        const {
          data
        } = await apis.userInfo.queryAddress({
          addressId
        });
        return data.userAddressVO;
      } catch (err) {
        console.error('查询地址错误', err);
        throw err;
      }
    },
    findPage(pageRouteUrl) {
      const currentRoutes = getCurrentPages().map(v => v.route);
      return currentRoutes.indexOf(pageRouteUrl);
    },
    async onHandleSubmit(params) {
      try {
        const orderPageDeltaNum = this.findPage('pages/order/order-confirm/index');
        if (orderPageDeltaNum > -1) {
          wx.navigateBack({
            delta: 1
          });
          resolveAddress(params);
          return;
        }
      } catch (err) {
        rejectAddress(params);
        console.error(err);
      }
    }
  }
});
</script>

<template>
<view class="wx-address t-class [&_.weixin]:[display:inline-block] [&_.weixin]:[font-size:48rpx] [&_.weixin]:[margin-right:20rpx] [&_.weixin]:[font-weight:normal] [&_.cell]:[padding:32rpx_30rpx] [&_.cell]:[border-radius:8rpx] [&_.cell__title]:[font-size:30rpx] [&_.cell__title]:[color:#333333]" bind:tap="getWxLocation">
  <block wx:if="{{isCustomStyle}}">
    <view class="wx-address-custom [display:flex] [align-items:center] [font-size:32rpx]">
      <t-icon prefix="wr" t-class="weixin" color="#0ABF5B" name="wechat" size="48rpx" />
      <text>{{title}}</text>
    </view>
    <slot />
  </block>
  <block wx:else>
    <t-cell title="{{title}}" title-class="cell__title" wr-class="cell" border="{{false}}">
      <t-icon t-class="weixin" slot="icon" color="#0ABF5B" name="logo-windows" size="48rpx" />
      <t-icon slot="right-icon" name="chevron-right" class="custom-icon" color="#bbb" />
    </t-cell>
  </block>
</view>
<t-toast id="t-toast" />
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-toast": "tdesign-miniprogram/toast/toast"
  }
}
</json>
