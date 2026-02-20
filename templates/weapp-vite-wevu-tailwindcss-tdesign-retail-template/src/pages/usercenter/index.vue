<script lang="ts">
import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import Toast from 'tdesign-miniprogram/toast/index';

const menuData = [
  [
    {
      title: '收货地址',
      tit: '',
      url: '',
      type: 'address',
    },
    {
      title: '优惠券',
      tit: '',
      url: '',
      type: 'coupon',
    },
    {
      title: '积分',
      tit: '',
      url: '',
      type: 'point',
    },
  ],
  [
    {
      title: '帮助中心',
      tit: '',
      url: '',
      type: 'help-center',
    },
    {
      title: '客服热线',
      tit: '',
      url: '',
      type: 'service',
      icon: 'service',
    },
  ],
];

const orderTagInfos = [
  {
    title: '待付款',
    iconName: 'wallet',
    orderNum: 0,
    tabType: 5,
    status: 1,
  },
  {
    title: '待发货',
    iconName: 'deliver',
    orderNum: 0,
    tabType: 10,
    status: 1,
  },
  {
    title: '待收货',
    iconName: 'package',
    orderNum: 0,
    tabType: 40,
    status: 1,
  },
  {
    title: '待评价',
    iconName: 'comment',
    orderNum: 0,
    tabType: 60,
    status: 1,
  },
  {
    title: '退款/售后',
    iconName: 'exchang',
    orderNum: 0,
    tabType: 0,
    status: 1,
  },
];

const getDefaultData = () => ({
  showMakePhone: false,
  userInfo: {
    avatarUrl: '',
    nickName: '正在登录...',
    phoneNumber: '',
  },
  menuData,
  orderTagInfos,
  customerServiceInfo: {},
  currAuthStep: 1,
  showKefu: true,
  versionNo: '',
});

Page({
  data: getDefaultData(),

  onLoad() {
    this.getVersionInfo();
  },

  onShow() {
    this.getTabBar().init();
    this.init();
  },
  onPullDownRefresh() {
    this.init();
  },

  init() {
    this.fetUseriInfoHandle();
  },

  fetUseriInfoHandle() {
    fetchUserCenter().then(({ userInfo, countsData, orderTagInfos: orderInfo, customerServiceInfo }) => {
      // eslint-disable-next-line no-unused-expressions
      menuData?.[0].forEach((v) => {
        countsData.forEach((counts) => {
          if (counts.type === v.type) {
            // eslint-disable-next-line no-param-reassign
            v.tit = counts.num;
          }
        });
      });
      const info = orderTagInfos.map((v, index) => ({
        ...v,
        ...orderInfo[index],
      }));
      this.setData({
        userInfo,
        menuData,
        orderTagInfos: info,
        customerServiceInfo,
        currAuthStep: 2,
      });
      wx.stopPullDownRefresh();
    });
  },

  onClickCell({ currentTarget }) {
    const { type } = currentTarget.dataset;

    switch (type) {
      case 'address': {
        wx.navigateTo({ url: '/pages/user/address/list/index' });
        break;
      }
      case 'service': {
        this.openMakePhone();
        break;
      }
      case 'help-center': {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '你点击了帮助中心',
          icon: '',
          duration: 1000,
        });
        break;
      }
      case 'point': {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '你点击了积分菜单',
          icon: '',
          duration: 1000,
        });
        break;
      }
      case 'coupon': {
        wx.navigateTo({ url: '/pages/coupon/coupon-list/index' });
        break;
      }
      default: {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '未知跳转',
          icon: '',
          duration: 1000,
        });
        break;
      }
    }
  },

  jumpNav(e) {
    const status = e.detail.tabType;

    if (status === 0) {
      wx.navigateTo({ url: '/pages/order/after-service-list/index' });
    } else {
      wx.navigateTo({ url: `/pages/order/order-list/index?status=${status}` });
    }
  },

  jumpAllOrder() {
    wx.navigateTo({ url: '/pages/order/order-list/index' });
  },

  openMakePhone() {
    this.setData({ showMakePhone: true });
  },

  closeMakePhone() {
    this.setData({ showMakePhone: false });
  },

  call() {
    wx.makePhoneCall({
      phoneNumber: this.data.customerServiceInfo.servicePhone,
    });
  },

  gotoUserEditPage() {
    const { currAuthStep } = this.data;
    if (currAuthStep === 2) {
      wx.navigateTo({ url: '/pages/user/person-info/index' });
    } else {
      this.fetUseriInfoHandle();
    }
  },

  getVersionInfo() {
    const versionInfo = wx.getAccountInfoSync();
    const { version, envVersion = __wxConfig } = versionInfo.miniProgram;
    this.setData({
      versionNo: envVersion === 'release' ? version : envVersion,
    });
  },
});
</script>

<template>
<t-user-center-card
  userInfo="{{userInfo}}"
  isPhoneHide="{{true}}"
  name-class="custom-name-class"
  phone-class="custom-phone-class"
  avatar-class="customer-avatar-class"
  currAuthStep="{{currAuthStep}}"
  bind:gotoUserEditPage="gotoUserEditPage"
/>
<view class="content-wrapper [margin-top:340rpx] [position:relative] [padding:0_30rpx]">
  <view class="order-group-wrapper [margin-bottom:16rpx]">
    <t-order-group orderTagInfos="{{orderTagInfos}}" bind:onClickTop="jumpAllOrder" bind:onClickItem="jumpNav" />
  </view>
  <view wx:for="{{menuData}}" wx:key="item" class="cell-box [border-radius:10rpx] [overflow:hidden] [margin-bottom:20rpx] [&_.order-group__left]:[margin-right:0] [&_.t-cell-padding]:[padding:24rpx_18rpx_24rpx_32rpx]">
    <t-cell-group>
      <t-cell
        wx:for="{{item}}"
        wx:for-item="xitem"
        wx:for-index="xindex"
        wx:key="xindex"
        title="{{xitem.title}}"
        arrow="{{!xitem.icon}}"
        note="{{xitem.tit}}"
        data-type="{{xitem.type}}"
        bordered="{{false}}"
        bind:click="onClickCell"
        t-class="t-cell-padding"
        t-class-note="order-group-note"
        t-class-left="order-group__left"
      >
        <t-icon name="{{xitem.icon}}" size="48rpx" slot="note" />
      </t-cell>
    </t-cell-group>
  </view>
</view>
<view class="footer__version [text-align:center] [margin-top:50rpx] [color:#999] [margin-bottom:4rpx] [font-size:24rpx] [line-height:32rpx]" wx:if="{{versionNo !== ''}}">当前版本 {{versionNo}}</view>
<t-popup visible="{{showMakePhone}}" placement="bottom" bind:visible-change="closeMakePhone" data-index="2">
  <view class="popup-content [background:#f5f5f5] [margin-bottom:env(safe-area-inset-bottom)] [border-radius:16rpx_16rpx_0_0] [&_.popup-title]:[background:#fff] [&_.popup-title]:[text-align:center] [&_.popup-title]:[font-size:24rpx] [&_.popup-title]:[color:#999] [&_.popup-title]:[height:112rpx] [&_.popup-title]:[line-height:112rpx] [&_.popup-title]:[border-radius:16rpx_16rpx_0_0] [&_.popup-phone]:[background:#fff] [&_.popup-phone]:[height:100rpx] [&_.popup-phone]:[display:flex] [&_.popup-phone]:[justify-content:center] [&_.popup-phone]:[align-items:center] [&_.popup-phone]:[text-align:center] [&_.popup-phone]:[font-size:30rpx] [&_.popup-phone]:[font-family:PingFangSC-Regular,_PingFang_SC] [&_.popup-phone]:[font-weight:400] [&_.popup-phone]:[color:#333] [&_.popup-close]:[background:#fff] [&_.popup-close]:[height:100rpx] [&_.popup-close]:[display:flex] [&_.popup-close]:[justify-content:center] [&_.popup-close]:[align-items:center] [&_.popup-close]:[text-align:center] [&_.popup-close]:[font-size:30rpx] [&_.popup-close]:[font-family:PingFangSC-Regular,_PingFang_SC] [&_.popup-close]:[font-weight:400] [&_.popup-close]:[color:#333] [&_.popup-phone_.online]:[margin-bottom:20rpx] [&_.popup-close]:[border:0] [&_.popup-close]:[margin-top:16rpx]">
    <view class="popup-title border-bottom-1px [position:relative]" wx:if="{{customerServiceInfo.serviceTimeDuration}}">
      服务时间: {{customerServiceInfo.serviceTimeDuration}}
    </view>
    <view class="popup-phone {{showKefu ? 'border-bottom-1px' : ''}} [position:relative]" bind:tap="call">电话客服</view>
    <button class="popup-phone border-bottom-1px online [position:relative]" open-type="contact" wx:if="{{showKefu}}">在线客服</button>
    <view class="popup-close" bind:tap="closeMakePhone">取消</view>
  </view>
</t-popup>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "个人中心",
  "navigationStyle": "custom",
  "usingComponents": {
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-user-center-card": "./components/user-center-card/index",
    "t-order-group": "./components/order-group/index",
    "t-toast": "tdesign-miniprogram/toast/toast"
  },
  "enablePullDownRefresh": true
}</json>
