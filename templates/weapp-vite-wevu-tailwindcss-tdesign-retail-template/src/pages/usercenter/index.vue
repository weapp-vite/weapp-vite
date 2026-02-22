<script setup lang="ts">
import { onLoad, onPullDownRefresh, onShow, ref, useNativeInstance } from 'wevu';
import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter';
import Toast from 'tdesign-miniprogram/toast/index';

interface MenuItem {
  title: string
  tit: string | number
  url: string
  type: string
  icon?: string
}

const nativeInstance = useNativeInstance() as any;

const showMakePhone = ref(false);
const userInfo = ref({
  avatarUrl: '',
  nickName: '正在登录...',
  phoneNumber: '',
});
const menuData = ref<MenuItem[][]>([
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
]);
const orderTagInfos = ref<Array<Record<string, any>>>([
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
]);
const customerServiceInfo = ref<Record<string, any>>({});
const currAuthStep = ref(1);
const showKefu = ref(true);
const versionNo = ref('');

function init() {
  void fetUseriInfoHandle();
}

function fetUseriInfoHandle() {
  fetchUserCenter().then(({
    userInfo: nextUserInfo,
    countsData,
    orderTagInfos: orderInfo,
    customerServiceInfo: nextCustomerServiceInfo,
  }: {
    userInfo: Partial<{ avatarUrl: string, nickName: string, phoneNumber: string }>
    countsData: Array<{ type: string, num: string | number }>
    orderTagInfos: Array<Record<string, any>>
    customerServiceInfo: Record<string, any>
  }) => {
    const nextMenuData = menuData.value.map(group => group.map(item => ({ ...item })));
    nextMenuData?.[0]?.forEach((item) => {
      countsData.forEach((counts) => {
        if (counts.type === item.type) {
          item.tit = counts.num;
        }
      });
    });
    const info = orderTagInfos.value.map((item, index) => ({
      ...item,
      ...(orderInfo[index] || {}),
    }));
    userInfo.value = {
      ...userInfo.value,
      ...nextUserInfo,
    };
    menuData.value = nextMenuData;
    orderTagInfos.value = info;
    customerServiceInfo.value = nextCustomerServiceInfo;
    currAuthStep.value = 2;
    wx.stopPullDownRefresh();
  });
}

function onClickCell({ currentTarget }: any) {
  const type = currentTarget?.dataset?.type;
  switch (type) {
    case 'address':
      wx.navigateTo({
        url: '/pages/user/address/list/index',
      });
      break;
    case 'service':
      openMakePhone();
      break;
    case 'help-center':
      Toast({
        context: nativeInstance,
        selector: '#t-toast',
        message: '你点击了帮助中心',
        icon: '',
        duration: 1000,
      });
      break;
    case 'point':
      Toast({
        context: nativeInstance,
        selector: '#t-toast',
        message: '你点击了积分菜单',
        icon: '',
        duration: 1000,
      });
      break;
    case 'coupon':
      wx.navigateTo({
        url: '/pages/coupon/coupon-list/index',
      });
      break;
    default:
      Toast({
        context: nativeInstance,
        selector: '#t-toast',
        message: '未知跳转',
        icon: '',
        duration: 1000,
      });
      break;
  }
}

function jumpNav(e: any) {
  const status = e?.detail?.tabType;
  if (status === 0) {
    wx.navigateTo({
      url: '/pages/order/after-service-list/index',
    });
  }
  else {
    wx.navigateTo({
      url: `/pages/order/order-list/index?status=${status}`,
    });
  }
}

function jumpAllOrder() {
  wx.navigateTo({
    url: '/pages/order/order-list/index',
  });
}

function openMakePhone() {
  showMakePhone.value = true;
}

function closeMakePhone() {
  showMakePhone.value = false;
}

function call() {
  wx.makePhoneCall({
    phoneNumber: customerServiceInfo.value.servicePhone,
  });
}

function gotoUserEditPage() {
  if (currAuthStep.value === 2) {
    wx.navigateTo({
      url: '/pages/user/person-info/index',
    });
  }
  else {
    fetUseriInfoHandle();
  }
}

function getVersionInfo() {
  const versionInfo = wx.getAccountInfoSync() as any;
  const miniProgramInfo = versionInfo?.miniProgram || {};
  const version = miniProgramInfo.version || '';
  const envVersion = miniProgramInfo.envVersion ?? (globalThis as any).__wxConfig;
  versionNo.value = envVersion === 'release' ? version : (envVersion || '');
}

onLoad(() => {
  getVersionInfo();
});

onShow(() => {
  nativeInstance.getTabBar?.()?.init?.();
  init();
});

onPullDownRefresh(() => {
  init();
});

defineExpose({
  showMakePhone,
  userInfo,
  menuData,
  orderTagInfos,
  customerServiceInfo,
  currAuthStep,
  showKefu,
  versionNo,
  onClickCell,
  jumpNav,
  jumpAllOrder,
  openMakePhone,
  closeMakePhone,
  call,
  gotoUserEditPage,
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
