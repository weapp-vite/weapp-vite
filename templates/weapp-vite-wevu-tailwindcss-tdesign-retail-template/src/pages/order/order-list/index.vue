<script lang="ts">
import { OrderStatus } from '../config';
import { fetchOrders, fetchOrdersCount } from '../../../services/order/orderList';
import { cosThumb } from '../../../utils/util';

Page({
  page: {
    size: 5,
    num: 1,
  },

  data: {
    tabs: [
      { key: -1, text: '全部' },
      { key: OrderStatus.PENDING_PAYMENT, text: '待付款', info: '' },
      { key: OrderStatus.PENDING_DELIVERY, text: '待发货', info: '' },
      { key: OrderStatus.PENDING_RECEIPT, text: '待收货', info: '' },
      { key: OrderStatus.COMPLETE, text: '已完成', info: '' },
    ],
    curTab: -1,
    orderList: [],
    listLoading: 0,
    pullDownRefreshing: false,
    emptyImg: 'https://tdesign.gtimg.com/miniprogram/template/retail/order/empty-order-list.png',
    backRefresh: false,
    status: -1,
  },

  onLoad(query) {
    let status = parseInt(query.status);
    status = this.data.tabs.map((t) => t.key).includes(status) ? status : -1;
    this.init(status);
    this.pullDownRefresh = this.selectComponent('#wr-pull-down-refresh');
  },

  onShow() {
    if (!this.data.backRefresh) return;
    this.onRefresh();
    this.setData({ backRefresh: false });
  },

  onReachBottom() {
    if (this.data.listLoading === 0) {
      this.getOrderList(this.data.curTab);
    }
  },

  onPageScroll(e) {
    this.pullDownRefresh && this.pullDownRefresh.onPageScroll(e);
  },

  onPullDownRefresh_(e) {
    const { callback } = e.detail;
    this.setData({ pullDownRefreshing: true });
    this.refreshList(this.data.curTab)
      .then(() => {
        this.setData({ pullDownRefreshing: false });
        callback && callback();
      })
      .catch((err) => {
        this.setData({ pullDownRefreshing: false });
        Promise.reject(err);
      });
  },

  init(status) {
    status = status !== undefined ? status : this.data.curTab;
    this.setData({
      status,
    });
    this.refreshList(status);
  },

  getOrderList(statusCode = -1, reset = false) {
    const params = {
      parameter: {
        pageSize: this.page.size,
        pageNum: this.page.num,
      },
    };
    if (statusCode !== -1) params.parameter.orderStatus = statusCode;
    this.setData({ listLoading: 1 });
    return fetchOrders(params)
      .then((res) => {
        this.page.num++;
        let orderList = [];
        if (res && res.data && res.data.orders) {
          orderList = (res.data.orders || []).map((order) => {
            return {
              id: order.orderId,
              orderNo: order.orderNo,
              parentOrderNo: order.parentOrderNo,
              storeId: order.storeId,
              storeName: order.storeName,
              status: order.orderStatus,
              statusDesc: order.orderStatusName,
              amount: order.paymentAmount,
              totalAmount: order.totalAmount,
              logisticsNo: order.logisticsVO.logisticsNo,
              createTime: order.createTime,
              goodsList: (order.orderItemVOs || []).map((goods) => ({
                id: goods.id,
                thumb: cosThumb(goods.goodsPictureUrl, 70),
                title: goods.goodsName,
                skuId: goods.skuId,
                spuId: goods.spuId,
                specs: (goods.specifications || []).map((spec) => spec.specValue),
                price: goods.tagPrice ? goods.tagPrice : goods.actualPrice,
                num: goods.buyQuantity,
                titlePrefixTags: goods.tagText ? [{ text: goods.tagText }] : [],
              })),
              buttons: order.buttonVOs || [],
              groupInfoVo: order.groupInfoVo,
              freightFee: order.freightFee,
            };
          });
        }
        return new Promise((resolve) => {
          if (reset) {
            this.setData({ orderList: [] }, () => resolve());
          } else resolve();
        }).then(() => {
          this.setData({
            orderList: this.data.orderList.concat(orderList),
            listLoading: orderList.length > 0 ? 0 : 2,
          });
        });
      })
      .catch((err) => {
        this.setData({ listLoading: 3 });
        return Promise.reject(err);
      });
  },

  onReTryLoad() {
    this.getOrderList(this.data.curTab);
  },

  onTabChange(e) {
    const { value } = e.detail;
    this.setData({
      status: value,
    });
    this.refreshList(value);
  },

  getOrdersCount() {
    return fetchOrdersCount().then((res) => {
      const tabsCount = res.data || [];
      const { tabs } = this.data;
      tabs.forEach((tab) => {
        const tabCount = tabsCount.find((c) => c.tabType === tab.key);
        if (tabCount) {
          tab.info = tabCount.orderNum;
        }
      });
      this.setData({ tabs });
    });
  },

  refreshList(status = -1) {
    this.page = {
      size: this.page.size,
      num: 1,
    };
    this.setData({ curTab: status, orderList: [] });

    return Promise.all([this.getOrderList(status, true), this.getOrdersCount()]);
  },

  onRefresh() {
    this.refreshList(this.data.curTab);
  },

  onOrderCardTap(e) {
    const { order } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/order/order-detail/index?orderNo=${order.orderNo}`,
    });
  },
});
</script>

<template>
<view class="page-container [&_.tab-bar__placeholder]:[height:88rpx] [&_.tab-bar__placeholder]:[line-height:88rpx] [&_.tab-bar__placeholder]:[background:#fff] [&_.tab-bar__inner]:[height:88rpx] [&_.tab-bar__inner]:[line-height:88rpx] [&_.tab-bar__inner]:[background:#fff] [&_.tab-bar__inner]:[font-size:26rpx] [&_.tab-bar__inner]:[color:#333333] [&_.tab-bar__inner]:[position:fixed] [&_.tab-bar__inner]:[width:100vw] [&_.tab-bar__inner]:[top:0] [&_.tab-bar__inner]:[left:0] [&_.tab-bar__inner_.order-nav_.order-nav-item_.bottom-line]:[bottom:12rpx] [&_.tab-bar__active]:[font-size:28rpx] [&_.specs-popup_.bottom-btn]:[color:#fa4126] [&_.specs-popup_.bottom-btn]:[color:var(--color-primary,_#fa4126)] [&_.order-number]:[color:#666666] [&_.order-number]:[font-size:28rpx]">
  <view class="tab-bar [&_.tab-bar__active]:[color:#333333] [&_.t-tabs-track]:[background:#333333]">
    <view class="tab-bar__placeholder" />
    <t-tabs
      t-class="tab-bar__inner [&_.t-tabs-is-active]:[color:#fa4126] [&_.t-tabs-track]:[background:#fa4126]"
      t-class-active="tab-bar__active"
      t-class-track="t-tabs-track"
      bind:change="onTabChange"
      value="{{status}}"
      style="position: fixed; top: 0; left: 0; z-index: 100"
    >
      <t-tab-panel
        wx:for="{{tabs}}"
        wx:for-index="index"
        wx:for-item="item"
        wx:key="index"
        label="{{item.text}}"
        value="{{item.key}}"
      />
    </t-tabs>
  </view>
  <t-pull-down-refresh
    id="pull-down-refresh"
    normal-bar-height="{{200}}"
    max-bar-height="{{272}}"
    refreshTimeout="{{3000}}"
    background="#f5f5f5"
    use-loading-slot
    loading-size="60rpx"
    bindrefresh="onPullDownRefresh_"
    t-class-indicator="t-class-indicator"
  >
    <order-card
      wx:for="{{orderList}}"
      wx:key="id"
      wx:for-item="order"
      wx:for-index="oIndex"
      order="{{order}}"
      defaultShowNum="{{3}}"
      data-order="{{order}}"
      bindcardtap="onOrderCardTap"
      useLogoSlot
    >
      <view slot="top-left" class="order-number">
        <text decode>订单号&nbsp;</text>
        {{order.orderNo}}
      </view>
      <specs-goods-card
        wx:for="{{order.goodsList}}"
        wx:key="id"
        wx:for-item="goods"
        wx:for-index="gIndex"
        data="{{goods}}"
        no-top-line="{{gIndex === 0}}"
      />
      <view slot="more">
        <view class="price-total [font-size:24rpx] [line-height:32rpx] [color:#999999] [padding-top:10rpx] [width:100%] [display:flex] [align-items:baseline] [justify-content:flex-end] [&_.bold-price]:[color:#333333] [&_.bold-price]:[font-size:28rpx] [&_.bold-price]:[line-height:40rpx] [&_.real-pay]:[font-size:36rpx] [&_.real-pay]:[line-height:48rpx] [&_.real-pay]:[color:#fa4126] [&_.real-pay]:[font-weight:bold]">
          <text>总价</text>
          <price fill price="{{order.totalAmount + ''}}" />
          <text>，运费</text>
          <price fill price="{{order.freightFee + ''}}" />
          <text decode>&nbsp;</text>
          <text class="bold-price" decode="{{true}}">实付&nbsp;</text>
          <price fill class="real-pay" price="{{order.amount + ''}}" decimalSmaller />
        </view>
        <!-- 订单按钮栏 -->
        <order-button-bar order="{{order}}" bindrefresh="onRefresh" data-order="{{order}}" />
      </view>
    </order-card>
    <!-- 列表加载中/已全部加载 -->
    <load-more
      wx:if="{{!pullDownRefreshing}}"
      list-is-empty="{{!orderList.length}}"
      status="{{listLoading}}"
      bindretry="onReTryLoad"
    >
      <!-- 空态 -->
      <view slot="empty" class="empty-wrapper [height:calc(100vh_-_88rpx)]">
        <t-empty t-class="t-empty-text [font-size:28rpx] [color:#999]" src="{{emptyImg}}">暂无相关订单</t-empty>
      </view>
    </load-more>
  </t-pull-down-refresh>
</view>
<t-toast id="t-toast" />
<t-dialog id="t-dialog" />
</template>

<json>
{
  "navigationBarTitleText": "我的订单",
  "usingComponents": {
    "t-tabs": "tdesign-miniprogram/tabs/tabs",
    "t-tab-panel": "tdesign-miniprogram/tab-panel/tab-panel",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-pull-down-refresh": "tdesign-miniprogram/pull-down-refresh/pull-down-refresh",
    "load-more": "/components/load-more/index",
    "order-button-bar": "../components/order-button-bar/index",
    "price": "/components/price/index",
    "order-card": "../components/order-card/index",
    "specs-goods-card": "../components/specs-goods-card/index"
  }
}</json>
