import Dialog from 'tdesign-miniprogram/dialog/index';
import Toast from 'tdesign-miniprogram/toast/index';

import { cancelRights } from '../../after-service-detail/api';
import { ServiceButtonTypes } from '../../config';

Component({
  properties: {
    service: {
      type: Object,
      observer(service) {
        if (!service) return;
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
