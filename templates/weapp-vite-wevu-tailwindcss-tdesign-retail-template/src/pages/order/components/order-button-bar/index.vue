<script setup lang="ts">
import Toast from 'tdesign-miniprogram/toast/index';
import Dialog from 'tdesign-miniprogram/dialog/index';
import { OrderButtonTypes } from '../../config';
defineOptions({
  options: {
    addGlobalClass: true
  },
  properties: {
    order: {
      type: Object,
      observer(order) {
        // 判定有传goodsIndex ，则认为是商品button bar, 仅显示申请售后按钮
        if (this.properties?.goodsIndex !== null) {
          const goods = order.goodsList[Number(this.properties.goodsIndex)];
          this.setData({
            buttons: {
              left: [],
              right: (goods.buttons || []).filter(b => b.type == OrderButtonTypes.APPLY_REFUND)
            }
          });
          return;
        }
        // 订单的button bar 不显示申请售后按钮
        const buttonsRight = (order.buttons || []
        // .filter((b) => b.type !== OrderButtonTypes.APPLY_REFUND)
        ).map(button => {
          //邀请好友拼团按钮
          if (button.type === OrderButtonTypes.INVITE_GROUPON && order.groupInfoVo) {
            const {
              groupInfoVo: {
                groupId,
                promotionId,
                remainMember,
                groupPrice
              },
              goodsList
            } = order;
            const goodsImg = goodsList[0] && goodsList[0].imgUrl;
            const goodsName = goodsList[0] && goodsList[0].name;
            return {
              ...button,
              openType: 'share',
              dataShare: {
                goodsImg,
                goodsName,
                groupId,
                promotionId,
                remainMember,
                groupPrice,
                storeId: order.storeId
              }
            };
          }
          return button;
        });
        // 删除订单按钮单独挪到左侧
        const deleteBtnIndex = buttonsRight.findIndex(b => b.type === OrderButtonTypes.DELETE);
        let buttonsLeft = [];
        if (deleteBtnIndex > -1) {
          buttonsLeft = buttonsRight.splice(deleteBtnIndex, 1);
        }
        this.setData({
          buttons: {
            left: buttonsLeft,
            right: buttonsRight
          }
        });
      }
    },
    goodsIndex: {
      type: Number,
      value: null
    },
    isBtnMax: {
      type: Boolean,
      value: false
    }
  },
  data() {
    return {
      order: {},
      buttons: {
        left: [],
        right: []
      }
    };
  },
  methods: {
    // 点击【订单操作】按钮，根据按钮类型分发
    onOrderBtnTap(e) {
      const {
        type
      } = e.currentTarget.dataset;
      switch (type) {
        case OrderButtonTypes.DELETE:
          this.onDelete(this.data.order);
          break;
        case OrderButtonTypes.CANCEL:
          this.onCancel(this.data.order);
          break;
        case OrderButtonTypes.CONFIRM:
          this.onConfirm(this.data.order);
          break;
        case OrderButtonTypes.PAY:
          this.onPay(this.data.order);
          break;
        case OrderButtonTypes.APPLY_REFUND:
          this.onApplyRefund(this.data.order);
          break;
        case OrderButtonTypes.VIEW_REFUND:
          this.onViewRefund(this.data.order);
          break;
        case OrderButtonTypes.COMMENT:
          this.onAddComment(this.data.order);
          break;
        case OrderButtonTypes.INVITE_GROUPON:
          //分享邀请好友拼团
          break;
        case OrderButtonTypes.REBUY:
          this.onBuyAgain(this.data.order);
      }
    },
    onCancel() {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '你点击了取消订单',
        icon: 'check-circle'
      });
    },
    onConfirm() {
      Dialog.confirm({
        title: '确认是否已经收到货？',
        content: '',
        confirmBtn: '确认收货',
        cancelBtn: '取消'
      }).then(() => {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '你确认了确认收货',
          icon: 'check-circle'
        });
      }).catch(() => {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '你取消了确认收货',
          icon: 'check-circle'
        });
      });
    },
    onPay() {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '你点击了去支付',
        icon: 'check-circle'
      });
    },
    onBuyAgain() {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '你点击了再次购买',
        icon: 'check-circle'
      });
    },
    onApplyRefund(order) {
      const goods = order.goodsList[this.properties.goodsIndex];
      const params = {
        orderNo: order.orderNo,
        skuId: goods?.skuId ?? '19384938948343',
        spuId: goods?.spuId ?? '28373847384343',
        orderStatus: order.status,
        logisticsNo: order.logisticsNo,
        price: goods?.price ?? 89,
        num: goods?.num ?? 89,
        createTime: order.createTime,
        orderAmt: order.totalAmount,
        payAmt: order.amount,
        canApplyReturn: true
      };
      const paramsStr = Object.keys(params).map(k => `${k}=${params[k]}`).join('&');
      wx.navigateTo({
        url: `/pages/order/apply-service/index?${paramsStr}`
      });
    },
    onViewRefund() {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '你点击了查看退款',
        icon: ''
      });
    },
    /** 添加订单评论 */
    onAddComment(order) {
      const imgUrl = order?.goodsList?.[0]?.thumb;
      const title = order?.goodsList?.[0]?.title;
      const specs = order?.goodsList?.[0]?.specs;
      wx.navigateTo({
        url: `/pages/goods/comments/create/index?specs=${specs}&title=${title}&orderNo=${order?.orderNo}&imgUrl=${imgUrl}`
      });
    }
  }
});
</script>

<template>
<view class="btn-bar [display:flex] [justify-content:space-between] [align-items:center] [line-height:1] [&_.order-btn]:[line-height:1] [&_.right]:[display:flex] [&_.right]:[align-items:center] [&_.t-button]:[width:160rpx] [&_.t-button]:[font-weight:400] [&_.t-button]:[margin-left:24rpx] [&_.t-button--max]:[width:176rpx] [&_.t-button--max]:[margin-left:24rpx] [&_.left_.delete-btn]:[font-size:22rpx]">
  <view class="left">
    <t-button
      wx:for="{{buttons.left}}"
      wx:key="type"
      wx:for-item="leftBtn"
      size="extra-small"
      shape="round"
      t-class="{{isBtnMax ? 't-button--max':'t-button'}}  order-btn delete-btn"
      hover-class="order-btn--active"
      catchtap="onOrderBtnTap"
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
      t-class="{{isBtnMax ? 't-button--max':'t-button'}} order-btn {{rightBtn.primary ? 'primary' : 'normal'}}"
      hover-class="order-btn--active"
      catchtap="onOrderBtnTap"
      data-type="{{rightBtn.type}}"
      open-type="{{ rightBtn.openType }}"
      data-share="{{ rightBtn.dataShare }}"
    >
      {{rightBtn.name}}
    </t-button>
  </view>
</view>
<t-toast id="t-toast" />
<t-dialog id="t-dialog" />
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-button": "tdesign-miniprogram/button/button",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog"
  }
}</json>
