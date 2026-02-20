<script lang="ts">
import Toast from 'tdesign-miniprogram/toast/index';
import { ServiceType, ServiceTypeDesc, ServiceStatus } from '../config';
import { formatTime, getRightsDetail } from './api';

const TitleConfig = {
  [ServiceType.ORDER_CANCEL]: '退款详情',
  [ServiceType.ONLY_REFUND]: '退款详情',
  [ServiceType.RETURN_GOODS]: '退货退款详情',
};

Page({
  data: {
    pageLoading: true,
    serviceRaw: {},
    service: {},
    deliveryButton: {},
    gallery: {
      current: 0,
      show: false,
      proofs: [],
    },
    showProofs: false,
    backRefresh: false,
  },

  onLoad(query) {
    this.rightsNo = query.rightsNo;
    this.inputDialog = this.selectComponent('#input-dialog');
    this.init();
  },

  onShow() {
    // 当从其他页面返回，并且 backRefresh 被置为 true 时，刷新数据
    if (!this.data.backRefresh) return;
    this.init();
    this.setData({ backRefresh: false });
  },

  // 页面刷新，展示下拉刷新
  onPullDownRefresh_(e) {
    const { callback } = e.detail;
    return this.getService().then(() => callback && callback());
  },

  init() {
    this.setData({ pageLoading: true });
    this.getService().then(() => {
      this.setData({ pageLoading: false });
    });
  },

  getService() {
    const params = { rightsNo: this.rightsNo };
    return getRightsDetail(params).then((res) => {
      const serviceRaw = res.data[0];
      // 滤掉填写运单号、修改运单号按钮，这两个按钮特殊处理，不在底部按钮栏展示
      if (!serviceRaw.buttonVOs) serviceRaw.buttonVOs = [];
      const deliveryButton = {};
      const service = {
        id: serviceRaw.rights.rightsNo,
        serviceNo: serviceRaw.rights.rightsNo,
        storeName: serviceRaw.rights.storeName,
        type: serviceRaw.rights.rightsType,
        typeDesc: ServiceTypeDesc[serviceRaw.rights.rightsType],
        status: serviceRaw.rights.rightsStatus,
        statusIcon: this.genStatusIcon(serviceRaw.rights),
        statusName: serviceRaw.rights.userRightsStatusName,
        statusDesc: serviceRaw.rights.userRightsStatusDesc,
        amount: serviceRaw.rights.refundRequestAmount,
        goodsList: (serviceRaw.rightsItem || []).map((item, i) => ({
          id: i,
          thumb: item.goodsPictureUrl,
          title: item.goodsName,
          specs: (item.specInfo || []).map((s) => s.specValues || ''),
          itemRefundAmount: item.itemRefundAmount,
          rightsQuantity: item.rightsQuantity,
        })),
        orderNo: serviceRaw.rights.orderNo, // 订单编号
        rightsNo: serviceRaw.rights.rightsNo, // 售后服务单号
        rightsReasonDesc: serviceRaw.rights.rightsReasonDesc, // 申请售后原因
        isRefunded: serviceRaw.rights.userRightsStatus === ServiceStatus.REFUNDED, // 是否已退款
        refundMethodList: (serviceRaw.refundMethodList || []).map((m) => ({
          name: m.refundMethodName,
          amount: m.refundMethodAmount,
        })), // 退款明细
        refundRequestAmount: serviceRaw.rights.refundRequestAmount, // 申请退款金额
        payTraceNo: serviceRaw.rightsRefund.traceNo, // 交易流水号
        createTime: formatTime(parseFloat(`${serviceRaw.rights.createTime}`), 'YYYY-MM-DD HH:mm'), // 申请时间
        logisticsNo: serviceRaw.logisticsVO.logisticsNo, // 退货物流单号
        logisticsCompanyName: serviceRaw.logisticsVO.logisticsCompanyName, // 退货物流公司
        logisticsCompanyCode: serviceRaw.logisticsVO.logisticsCompanyCode, // 退货物流公司
        remark: serviceRaw.logisticsVO.remark, // 退货备注
        receiverName: serviceRaw.logisticsVO.receiverName, // 收货人
        receiverPhone: serviceRaw.logisticsVO.receiverPhone, // 收货人电话
        receiverAddress: this.composeAddress(serviceRaw), // 收货人地址
        applyRemark: serviceRaw.rightsRefund.refundDesc, // 申请退款时的填写的说明
        buttons: serviceRaw.buttonVOs || [],
        logistics: serviceRaw.logisticsVO,
      };
      const proofs = serviceRaw.rights.rightsImageUrls || [];
      this.setData({
        serviceRaw,
        service,
        deliveryButton,
        'gallery.proofs': proofs,
        showProofs:
          serviceRaw.rights.userRightsStatus === ServiceStatus.PENDING_VERIFY &&
          (service.applyRemark || proofs.length > 0),
      });
      wx.setNavigationBarTitle({
        title: TitleConfig[service.type],
      });
    });
  },

  composeAddress(service) {
    return [
      service.logisticsVO.receiverProvince,
      service.logisticsVO.receiverCity,
      service.logisticsVO.receiverCountry,
      service.logisticsVO.receiverArea,
      service.logisticsVO.receiverAddress,
    ]
      .filter((item) => !!item)
      .join(' ');
  },

  onRefresh() {
    this.init();
  },

  editLogistices() {
    this.setData({
      inputDialogVisible: true,
    });
    this.inputDialog.setData({
      cancelBtn: '取消',
      confirmBtn: '确定',
    });
    this.inputDialog._onConfirm = () => {
      Toast({
        message: '确定填写物流单号',
      });
    };
  },

  onProofTap(e) {
    if (this.data.gallery.show) {
      this.setData({
        'gallery.show': false,
      });
      return;
    }
    const { index } = e.currentTarget.dataset;
    this.setData({
      'gallery.show': true,
      'gallery.current': index,
    });
  },

  onGoodsCardTap(e) {
    const { index } = e.currentTarget.dataset;
    const goods = this.data.serviceRaw.rightsItem[index];
    wx.navigateTo({ url: `/pages/goods/details/index?skuId=${goods.skuId}` });
  },

  onServiceNoCopy() {
    wx.setClipboardData({
      data: this.data.service.serviceNo,
    });
  },

  onAddressCopy() {
    wx.setClipboardData({
      data: `${this.data.service.receiverName}  ${this.data.service.receiverPhone}\n${this.data.service.receiverAddress}`,
    });
  },

  /** 获取状态ICON */
  genStatusIcon(item) {
    const { userRightsStatus, afterSaleRequireType } = item;
    switch (userRightsStatus) {
      // 退款成功
      case ServiceStatus.REFUNDED: {
        return 'succeed';
      }
      // 已取消、已关闭
      case ServiceStatus.CLOSED: {
        return 'indent_close';
      }
      default: {
        switch (afterSaleRequireType) {
          case 'REFUND_MONEY': {
            return 'goods_refund';
          }
          case 'REFUND_GOODS_MONEY':
            return 'goods_return';
          default: {
            return 'goods_return';
          }
        }
      }
    }
  },
});
</script>

<template>
<wr-loading-content position="fixed" type="spinner" wx:if="{{pageLoading}}" />
<view class="page-container [&_.wr-goods-card__specs]:[margin:14rpx_20rpx_0_0] [&_.order-card_.header_.store-name]:[-webkit-line-clamp:1] [&_.order-card_.header_.store-name]:[display:-webkit-box] [&_.order-card_.header_.store-name]:[-webkit-box-orient:vertical] [&_.order-card_.header_.store-name]:[overflow:hidden] [&_.order-card_.header_.store-name]:[width:80%] [&_.status-desc]:[box-sizing:border-box] [&_.status-desc]:[padding:22rpx_20rpx] [&_.status-desc]:[font-size:26rpx] [&_.status-desc]:[line-height:1.3] [&_.status-desc]:[text-align:left] [&_.status-desc]:[color:#333333] [&_.status-desc]:[background-color:#f5f5f5] [&_.status-desc]:[border-radius:8rpx] [&_.status-desc]:[word-wrap:break-word] [&_.status-desc]:[margin-top:40rpx] [&_.status-desc]:[margin-bottom:20rpx] [&_.header__right]:[font-size:24rpx] [&_.header__right]:[color:#333333] [&_.header__right]:[display:flex] [&_.header__right]:[align-items:center] [&_.header__right__icon]:[color:#d05b27] [&_.header__right__icon]:[font-size:16px] [&_.header__right__icon]:[margin-right:10rpx] [&_.wr-goods-card__thumb]:[width:140rpx] [&_.page-background]:[position:absolute] [&_.page-background]:[z-index:-1] [&_.page-background]:[top:0] [&_.page-background]:[left:0] [&_.page-background]:[width:100vw] [&_.page-background]:[color:#fff] [&_.page-background]:[overflow:hidden] [&_.page-background-img]:[width:100%] [&_.page-background-img]:[height:320rpx] [&_.navbar-bg_.nav-back]:[background:linear-gradient(to_right,_rgba(250,_85,_15,_1)_0%,_rgba(250,_85,_15,_0.6)_100%)] [&_.navbar-bg_.page-background]:[background:linear-gradient(to_right,_rgba(250,_85,_15,_1)_0%,_rgba(250,_85,_15,_0.6)_100%)] [&_.navigation-bar__btn]:[font-size:40rpx] [&_.navigation-bar__btn]:[font-weight:bold] [&_.navigation-bar__btn]:[color:#333] [&_.navigation-bar__inner_.navigation-bar__left]:[padding-left:16rpx]">
  <t-pull-down-refresh id="t-pull-down-refresh" bind:refresh="onPullDownRefresh_" t-class-indicator="t-class-indicator">
    <!-- 页面内容 -->
    <view class="service-detail safe-bottom [position:relative] [padding-bottom:env(safe-area-inset-bottom)] [&_.wr-goods-card__body]:[margin-left:50rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-size:36rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-size:28rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-size:24rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-family:DIN_Alternate] [&_.service-detail__header]:[padding:60rpx_0_48rpx_40rpx] [&_.service-detail__header]:[box-sizing:border-box] [&_.service-detail__header]:[height:220rpx] [&_.service-detail__header]:[background-color:#fff] [&_.service-detail__header_.title]:[overflow:hidden] [&_.service-detail__header_.title]:[display:-webkit-box] [&_.service-detail__header_.title]:[-webkit-box-orient:vertical] [&_.service-detail__header_.desc]:[overflow:hidden] [&_.service-detail__header_.desc]:[display:-webkit-box] [&_.service-detail__header_.desc]:[-webkit-box-orient:vertical] [&_.service-detail__header_.title]:[-webkit-line-clamp:1] [&_.service-detail__header_.title]:[font-size:48rpx] [&_.service-detail__header_.title]:[font-weight:bold] [&_.service-detail__header_.title]:[color:#333] [&_.service-detail__header_.title]:[display:flex] [&_.service-detail__header_.desc]:[-webkit-line-clamp:2] [&_.service-detail__header_.desc]:[margin-top:10rpx] [&_.service-detail__header_.desc]:[font-size:28rpx] [&_.service-detail__header_.desc]:[color:#999] [&_.service-detail__header_.desc_.count-down]:[color:#fff185] [&_.service-detail__header_.desc_.count-down]:[display:inline] [&_.service-section]:[margin:20rpx_0_20rpx_0] [&_.service-section]:[width:auto] [&_.service-section]:[border-radius:8rpx] [&_.service-section]:[background-color:white] [&_.service-section]:[overflow:hidden] [&_.service-section__title]:[color:#333333] [&_.service-section__title]:[margin-bottom:10rpx] [&_.service-section__title]:[padding-bottom:18rpx] [&_.service-section__title]:[height:224rpx] [&_.service-section__title]:[position:relative] [&_.service-section__title_.icon]:[margin-right:16rpx] [&_.service-section__title_.icon]:[font-size:40rpx] [&_.service-section__title_.right]:[flex:none] [&_.service-section__title_.right]:[font-weight:normal] [&_.service-section__title_.right]:[font-size:26rpx] [&_.section-content]:[margin:16rpx_0_0_52rpx] [&_.main]:[font-size:28rpx] [&_.main]:[color:#222427] [&_.main]:[font-weight:bold] [&_.main_.phone-num]:[margin-left:16rpx] [&_.main_.phone-num]:[display:inline] [&_.label]:[color:#999999] [&_.label]:[font-size:26rpx] [&_.custom-remark]:[font-size:26rpx] [&_.custom-remark]:[line-height:36rpx] [&_.custom-remark]:[color:#333333] [&_.custom-remark]:[word-wrap:break-word] [&_.proofs]:[margin-top:20rpx] [&_.proofs_.proof]:[width:100%] [&_.proofs_.proof]:[height:100%] [&_.proofs_.proof]:[background-color:#f9f9f9] [&_.pay-result_.t-cell-title]:[color:#666666] [&_.pay-result_.t-cell-title]:[font-size:28rpx] [&_.pay-result_.t-cell-value]:[color:#666666] [&_.pay-result_.t-cell-value]:[font-size:28rpx] [&_.pay-result_.wr-cell__value]:[font-weight:bold] [&_.right]:[font-size:36rpx] [&_.right]:[color:#fa550f] [&_.right]:[font-weight:bold] [&_.title]:[font-weight:bold] [&_.pay-result_.service-section__title_.right_.integer]:[font-size:48rpx] [&_.pay-result_.split-line]:[position:relative] [&_.pay-result_.section-content]:[margin-left:0] [&_.pay-result_.section-content_.label]:[color:#999999] [&_.pay-result_.section-content_.label]:[font-size:24rpx] [&_.footer-bar-wrapper]:[height:100rpx] [&_.footer-bar-wrapper_.footer-bar]:[position:fixed] [&_.footer-bar-wrapper_.footer-bar]:[left:0] [&_.footer-bar-wrapper_.footer-bar]:[bottom:0] [&_.footer-bar-wrapper_.footer-bar]:[height:100rpx] [&_.footer-bar-wrapper_.footer-bar]:[width:100vw] [&_.footer-bar-wrapper_.footer-bar]:[box-sizing:border-box] [&_.footer-bar-wrapper_.footer-bar]:[padding:0_20rpx] [&_.footer-bar-wrapper_.footer-bar]:[background-color:white] [&_.footer-bar-wrapper_.footer-bar]:[display:flex] [&_.footer-bar-wrapper_.footer-bar]:[justify-content:space-between] [&_.footer-bar-wrapper_.footer-bar]:[align-items:center] [&_.text-btn]:[display:inline] [&_.text-btn]:[box-sizing:border-box] [&_.text-btn]:[color:#333] [&_.text-btn]:[border:2rpx_solid_#ddd] [&_.text-btn]:[border-radius:32rpx] [&_.text-btn]:[margin-left:10rpx] [&_.text-btn]:[padding:0_16rpx] [&_.text-btn]:[font-weight:normal] [&_.text-btn]:[font-size:24rpx] [&_.text-btn]:[line-height:32rpx] [&_.text-btn--active]:[opacity:0.5] [&_.specs-popup_.bottom-btn]:[color:#fa550f] [&_.logistics]:[padding-top:0] [&_.logistics]:[padding-bottom:0] [&_.logistics]:[padding-right:0] [&_.goods-refund-address]:[padding-top:0] [&_.goods-refund-address]:[padding-bottom:0] [&_.goods-refund-address_.goods-refund-address-copy-btn]:[position:absolute] [&_.goods-refund-address_.goods-refund-address-copy-btn]:[top:22rpx] [&_.goods-refund-address_.goods-refund-address-copy-btn]:[right:32rpx] [&_.service-goods-card-wrap]:[padding:0_32rpx]">
      <!-- 状态及描述 -->
      <view class="service-detail__header">
        <view class="title">
          <t-icon prefix="wr" name="{{service.statusIcon}}" size="30px" />
          {{service.statusName}}
        </view>
        <view class="desc"> {{service.statusDesc}} </view>
      </view>
      <!-- 退款金额 -->
      <view class="service-section__pay pay-result [margin:0_0_20rpx_0] [width:auto] [border-radius:8rpx] [background-color:white] [overflow:hidden] [&_.credential_desc]:[padding:0_24rpx] [&_.t-grid-item__content]:[padding:0_0_24rpx]" wx:if="{{service.isRefunded}}">
        <t-cell
          t-class-title="title"
          t-class-note="right"
          t-class="t-class-wrapper-first-child ![padding:24rpx]"
          title="{{service.isRefunded ? '退款金额' : '预计退款金额'}}"
          bordered="{{false}}"
        >
          <wr-price slot="note" price="{{service.refundRequestAmount}}" fill />
        </t-cell>
        <t-cell
          wx:for="{{service.refundMethodList}}"
          wx:key="name"
          wx:for-index="index"
          wx:for-item="item"
          t-class-title="t-cell-title"
          t-class-note="t-cell-title"
          t-class="t-class-wrapper ![padding:10rpx_24rpx]"
          title="{{item.name}}"
          bordered="{{service.refundMethodList.length - 1 === index ? true : false}}"
        >
          <wr-price slot="note" price="{{item.amount}}" fill />
        </t-cell>
        <block wx:if="{{service.isRefunded}}">
          <t-cell
            title=""
            t-class="t-class-wrapper-first-child ![padding:24rpx]"
            t-class-description="label"
            description="说明：微信退款后，可以在微信支付账单查询，实际退款到时间可能受到银行处理时间的影响有一定延时，可以稍后查看"
          />
        </block>
      </view>
      <!-- 物流 -->
      <view class="service-section logistics" wx:if="{{service.logisticsNo}}">
        <view class="service-section__title">
          <t-cell
            align="top"
            title="{{service.logisticsCompanyName + ' ' + service.logisticsNo}}"
            bordered="{{false}}"
            description="买家已寄出"
            arrow
          >
            <t-icon prefix="wr" color="#333333" name="deliver" size="40rpx" slot="left-icon" />
          </t-cell>
          <view style="padding: 0 32rpx">
            <wr-after-service-button-bar service="{{service}}" />
          </view>
        </view>
      </view>
      <!-- 收货地址 -->
      <view class="service-section goods-refund-address" wx:if="{{service.receiverName}}">
        <t-cell-group>
          <t-cell align="top" title="退货地址" bordered="{{false}}">
            <t-icon prefix="wr" color="#333333" name="location" size="40rpx" slot="left-icon" />
            <view
              slot="note"
              class="right text-btn goods-refund-address-copy-btn"
              hover-class="text-btn--active"
              bindtap="onAddressCopy"
              >复制
            </view>
            <view slot="description">
              <view> {{service.receiverAddress}} </view>
              <view>收货人：{{service.receiverName}}</view>
              <view>收货人手机：{{service.receiverName}}</view>
            </view>
          </t-cell>
        </t-cell-group>
      </view>
      <!-- 商品卡片 -->
      <view
        class="service-section service-goods-card-wrap"
        wx:if="{{service.goodsList && service.goodsList.length > 0}}"
      >
        <wr-service-goods-card
          wx:for="{{service.goodsList}}"
          wx:key="id"
          wx:for-item="goods"
          goods="{{goods}}"
          no-top-line
          bindtap="onGoodsCardTap"
          data-index="{{index}}"
        >
          <view slot="footer" class="order-goods-card-footer [display:flex] [width:calc(100%_-_190rpx)] [justify-content:space-between] [position:absolute] [bottom:20rpx] [left:190rpx]">
            <wr-price
              price="{{goods.itemRefundAmount}}"
              fill
              wr-class="order-goods-card-footer-price-class"
              symbol-class="order-goods-card-footer-price-symbol"
              decimal-class="order-goods-card-footer-price-decimal"
            />
            <view class="order-goods-card-footer-num [color:#999] [line-height:40rpx]">x {{goods.rightsQuantity}}</view>
          </view>
        </wr-service-goods-card>
      </view>
      <!-- 退款信息 -->
      <view class="service-section__pay [margin:0_0_20rpx_0] [width:auto] [border-radius:8rpx] [background-color:white] [overflow:hidden] [&_.credential_desc]:[padding:0_24rpx] [&_.t-grid-item__content]:[padding:0_0_24rpx]">
        <t-cell bordered="{{false}}" title="退款信息" t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]" t-class-title="t-refund-title" />
        <t-cell
          bordered="{{false}}"
          t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
          t-class-title="t-refund-info"
          t-class-note="t-refund-note"
          title="订单编号"
          note="{{service.orderNo}}"
        />
        <t-cell
          bordered="{{false}}"
          t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
          t-class-title="t-refund-info"
          t-class-note="t-refund-note"
          title="服务单号"
          note="{{service.rightsNo}}"
        >
          <view slot="right-icon" class="text-btn" hover-class="text-btn--active" bindtap="onServiceNoCopy">复制 </view>
        </t-cell>
        <t-cell
          bordered="{{false}}"
          t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
          t-class-title="t-refund-info"
          t-class-note="t-refund-note"
          title="退款原因"
          note="{{service.rightsReasonDesc}}"
        />
        <t-cell
          bordered="{{false}}"
          t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
          t-class-title="t-refund-info"
          t-class-note="t-refund-note"
          title="退款金额"
        >
          <wr-price slot="note" price="{{service.refundRequestAmount}}" fill />
        </t-cell>
        <t-cell
          bordered="{{false}}"
          t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
          t-class-title="t-refund-info"
          t-class-note="t-refund-note"
          title="申请时间"
          note="{{service.createTime}}"
        />
      </view>
      <!-- 凭证/说明 -->
      <view class="service-section__pay credential_desc [margin:0_0_20rpx_0] [width:auto] [border-radius:8rpx] [background-color:white] [overflow:hidden] [padding:0_24rpx] [&_.credential_desc]:[padding:0_24rpx] [&_.t-grid-item__content]:[padding:0_0_24rpx]" wx:if="{{showProofs}}">
        <t-cell
          bordered="{{false}}"
          title="凭证/说明"
          t-class="t-refund-wrapper ![padding-top:18rpx] ![padding-bottom:18rpx]"
          t-class-title="t-refund-info"
          description="{{service.applyRemark}}"
        />
        <t-grid border="{{false}}" column="{{3}}">
          <t-grid-item
            t-class-image="t-refund-grid-image"
            wx:for="{{gallery.proofs}}"
            wx:key="index"
            image="{{item}}"
            bindclick="onProofTap"
            data-index="{{index}}"
          />
        </t-grid>
      </view>
      <t-swiper
        wx:if="{{gallery.show}}"
        current="{{gallery.current}}"
        img-srcs="{{gallery.proofs}}"
        full-screen
        circular="{{false}}"
        bindtap="onProofTap"
      />
    </view>
  </t-pull-down-refresh>
</view>
<t-toast id="t-toast" />
<!-- 退款说明填写 -->
<t-dialog id="input-dialog" visible="{{inputDialogVisible}}">
  <view class="input-dialog__content" slot="content">
    <view style="color: #333333; padding-left: 32rpx">物流单号</view>
    <t-input class="input" placeholder="请输入物流单号" />
    <view class="tips">{{amountTip}}</view>
  </view>
</t-dialog>
<t-dialog id="t-dialog" />
</template>

<json>
{
  "navigationBarTitleText": "",
  "usingComponents": {
    "wr-loading-content": "/components/loading-content/index",
    "wr-price": "/components/price/index",
    "wr-service-goods-card": "../components/order-goods-card/index",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-pull-down-refresh": "tdesign-miniprogram/pull-down-refresh/pull-down-refresh",
    "t-grid": "tdesign-miniprogram/grid/grid",
    "t-grid-item": "tdesign-miniprogram/grid-item/grid-item",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-input": "tdesign-miniprogram/input/input",
    "t-swiper": "tdesign-miniprogram/swiper/swiper",
    "t-swiper-nav": "tdesign-miniprogram/swiper-nav/swiper-nav",
    "wr-after-service-button-bar": "../components/after-service-button-bar/index",
    "t-image": "/components/webp-image/index"
  }
}</json>
