<script lang="ts">
import Dialog from 'tdesign-miniprogram/dialog/index';
import Toast from 'tdesign-miniprogram/toast/index';

import { cancelRights } from '../../after-service-detail/api';
import { ServiceButtonTypes } from '../../config';

Component({
  properties: {
    service: {
      type: Object,
      observer(service) {
        const buttonsRight = service.buttons || service.buttonVOs || [];
        this.setData({
          buttons: {
            left: [],
            right: buttonsRight,
          },
        });
      },
    },
  },

  data: {
    service: {},
    buttons: {
      left: [],
      right: [],
    },
  },

  methods: {
    // 点击【订单操作】按钮，根据按钮类型分发
    onServiceBtnTap(e) {
      const { type } = e.currentTarget.dataset;
      switch (type) {
        case ServiceButtonTypes.REVOKE:
          this.onConfirm(this.data.service);
          break;
        case ServiceButtonTypes.FILL_TRACKING_NO:
          this.onFillTrackingNo(this.data.service);
          break;
        case ServiceButtonTypes.CHANGE_TRACKING_NO:
          this.onChangeTrackingNo(this.data.service);
          break;
        case ServiceButtonTypes.VIEW_DELIVERY:
          this.viewDelivery(this.data.service);
          break;
      }
    },

    onFillTrackingNo(service) {
      wx.navigateTo({
        url: `/pages/order/fill-tracking-no/index?rightsNo=${service.id}`,
      });
    },

    viewDelivery(service) {
      wx.navigateTo({
        url: `/pages/order/delivery-detail/index?data=${JSON.stringify(
          service.logistics || service.logisticsVO,
        )}&source=2`,
      });
    },

    onChangeTrackingNo(service) {
      wx.navigateTo({
        url: `/pages/order/fill-tracking-no/index?rightsNo=${
          service.id
        }&logisticsNo=${service.logisticsNo}&logisticsCompanyName=${
          service.logisticsCompanyName
        }&logisticsCompanyCode=${service.logisticsCompanyCode}&remark=${
          service.remark || ''
        }`,
      });
    },

    onConfirm() {
      Dialog.confirm({
        title: '是否撤销退货申请？',
        content: '',
        confirmBtn: '撤销申请',
        cancelBtn: '不撤销',
      }).then(() => {
        const params = { rightsNo: this.data.service.id };
        return cancelRights(params).then(() => {
          Toast({
            context: this,
            selector: '#t-toast',
            message: '你确认撤销申请',
          });
        });
      });
    },
  },
});
</script>

<template>
<view class="btn-bar [display:flex] [justify-content:space-between] [align-items:center] [line-height:1] [&_.order-btn]:[background-color:inherit] [&_.order-btn]:[font-size:26rpx] [&_.order-btn]:[padding:16rpx_28rpx] [&_.order-btn]:[line-height:1] [&_.order-btn]:[border-radius:unset] [&_.order-btn]:[min-width:160rpx] [&_.order-btn]:[border-radius:32rpx] [&_.order-btn]:[height:60rpx] [&_.order-btn]:[margin-right:10rpx] [&_.left_.delete-btn]:[font-size:22rpx]">
  <view class="left">
    <t-button
      wx:for="{{buttons.left}}"
      wx:key="type"
      wx:for-item="leftBtn"
      size="extra-small"
      shape="round"
      t-class="order-btn delete-btn"
      catchtap="onServiceBtnTap"
      data-type="{{leftBtn.type}}"
    >
      {{leftBtn.name}}
    </t-button>
  </view>
  <view class="right">
    <t-button
      wx:for="{{buttons.right}}"
      wx:key="type"
      wx:for-item="rightBtn"
      size="extra-small"
      variant="{{ rightBtn.primary ? 'base' : 'outline'}}"
      shape="round"
      t-class="order-btn {{rightBtn.primary ? 'primary' : 'normal'}}"
      catchtap="onServiceBtnTap"
      data-type="{{rightBtn.type}}"
      open-type="{{ rightBtn.openType }}"
      data-share="{{ rightBtn.dataShare }}"
    >
      {{rightBtn.name}}
    </t-button>
  </view>
</view>
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button"
  }
}
</json>
