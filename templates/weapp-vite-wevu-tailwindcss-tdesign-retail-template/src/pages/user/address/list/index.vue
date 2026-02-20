<script lang="ts">
/* eslint-disable no-param-reassign */
import { fetchDeliveryAddressList } from '../../../../services/address/fetchAddress';
import Toast from 'tdesign-miniprogram/toast/index';
import { resolveAddress, rejectAddress } from '../../../../services/address/list';
import { getAddressPromise } from '../../../../services/address/edit';

Page({
  data: {
    addressList: [],
    deleteID: '',
    showDeleteConfirm: false,
    isOrderSure: false,
  },

  /** 选择模式 */
  selectMode: false,
  /** 是否已经选择地址，不置为true的话页面离开时会触发取消选择行为 */
  hasSelect: false,

  onLoad(query) {
    const { selectMode = '', isOrderSure = '', id = '' } = query;
    this.setData({
      isOrderSure: !!isOrderSure,
      id,
    });
    this.selectMode = !!selectMode;
    this.init();
  },

  init() {
    this.getAddressList();
  },
  onUnload() {
    if (this.selectMode && !this.hasSelect) {
      rejectAddress();
    }
  },
  getAddressList() {
    const { id } = this.data;
    fetchDeliveryAddressList().then((addressList) => {
      addressList.forEach((address) => {
        if (address.id === id) {
          address.checked = true;
        }
      });
      this.setData({ addressList });
    });
  },
  getWXAddressHandle() {
    wx.chooseAddress({
      success: (res) => {
        if (res.errMsg.indexOf('ok') === -1) {
          Toast({
            context: this,
            selector: '#t-toast',
            message: res.errMsg,
            icon: '',
            duration: 1000,
          });
          return;
        }
        Toast({
          context: this,
          selector: '#t-toast',
          message: '添加成功',
          icon: '',
          duration: 1000,
        });
        const { length: len } = this.data.addressList;
        this.setData({
          [`addressList[${len}]`]: {
            name: res.userName,
            phoneNumber: res.telNumber,
            address: `${res.provinceName}${res.cityName}${res.countryName}${res.detailInfo}`,
            isDefault: 0,
            tag: '微信地址',
            id: len,
          },
        });
      },
    });
  },
  confirmDeleteHandle({ detail }) {
    const { id } = detail || {};
    if (id !== undefined) {
      this.setData({ deleteID: id, showDeleteConfirm: true });
      Toast({
        context: this,
        selector: '#t-toast',
        message: '地址删除成功',
        theme: 'success',
        duration: 1000,
      });
    } else {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '需要组件库发新版才能拿到地址ID',
        icon: '',
        duration: 1000,
      });
    }
  },
  deleteAddressHandle(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      addressList: this.data.addressList.filter((address) => address.id !== id),
      deleteID: '',
      showDeleteConfirm: false,
    });
  },
  editAddressHandle({ detail }) {
    this.waitForNewAddress();

    const { id } = detail || {};
    wx.navigateTo({ url: `/pages/user/address/edit/index?id=${id}` });
  },
  selectHandle({ detail }) {
    if (this.selectMode) {
      this.hasSelect = true;
      resolveAddress(detail);
      wx.navigateBack({ delta: 1 });
    } else {
      this.editAddressHandle({ detail });
    }
  },
  createHandle() {
    this.waitForNewAddress();
    wx.navigateTo({ url: '/pages/user/address/edit/index' });
  },

  waitForNewAddress() {
    getAddressPromise()
      .then((newAddress) => {
        let addressList = [...this.data.addressList];

        newAddress.phoneNumber = newAddress.phone;
        newAddress.address = `${newAddress.provinceName}${newAddress.cityName}${newAddress.districtName}${newAddress.detailAddress}`;
        newAddress.tag = newAddress.addressTag;

        if (!newAddress.addressId) {
          newAddress.id = `${addressList.length}`;
          newAddress.addressId = `${addressList.length}`;

          if (newAddress.isDefault === 1) {
            addressList = addressList.map((address) => {
              address.isDefault = 0;

              return address;
            });
          } else {
            newAddress.isDefault = 0;
          }

          addressList.push(newAddress);
        } else {
          addressList = addressList.map((address) => {
            if (address.addressId === newAddress.addressId) {
              return newAddress;
            }
            return address;
          });
        }

        addressList.sort((prevAddress, nextAddress) => {
          if (prevAddress.isDefault && !nextAddress.isDefault) {
            return -1;
          }
          if (!prevAddress.isDefault && nextAddress.isDefault) {
            return 1;
          }
          return 0;
        });

        this.setData({
          addressList: addressList,
        });
      })
      .catch((e) => {
        if (e.message !== 'cancel') {
          Toast({
            context: this,
            selector: '#t-toast',
            message: '地址编辑发生错误',
            icon: '',
            duration: 1000,
          });
        }
      });
  },
});
</script>

<template>
<view class="address-container [display:flex] [flex-direction:column] [align-items:stretch] [padding-bottom:calc(env(safe-area-inset-bottom)_+_172rpx)] [&_.address-list]:[font-size:24rpx] [&_.address-list]:[background-color:#ffffff] [&_.address-list]:[-webkit-overflow-scrolling:touch] [&_.bottom-fixed]:[border-top:1rpx_solid_#e5e5e5] [&_.bottom-fixed]:[position:fixed] [&_.bottom-fixed]:[bottom:0] [&_.bottom-fixed]:[left:0] [&_.bottom-fixed]:[right:0] [&_.bottom-fixed]:[z-index:1000] [&_.bottom-fixed]:[background:#fff] [&_.bottom-fixed]:[display:flex] [&_.bottom-fixed]:[justify-content:center] [&_.bottom-fixed]:[flex-direction:column] [&_.bottom-fixed]:[align-items:center] [&_.bottom-fixed]:[padding:12rpx_32rpx_calc(env(safe-area-inset-bottom)_+_12rpx)_32rpx] [&_.btn-wrap]:[width:100%] [&_.btn-wrap]:[display:flex] [&_.btn-wrap]:[justify-content:space-between] [&_.btn-wrap]:[align-items:center] [&_.btn-wrap]:[font-size:32rpx] [&_.btn-wrap]:[font-weight:bold] [&_.btn-wrap_.location-btn]:[width:332rpx] [&_.btn-wrap_.location-btn]:[height:88rpx] [&_.btn-wrap_.location-btn]:[display:flex] [&_.btn-wrap_.location-btn]:[justify-content:center] [&_.btn-wrap_.location-btn]:[align-items:center] [&_.btn-wrap_.location-btn]:[background-color:#ffffff] [&_.btn-wrap_.location-btn]:[color:#333] [&_.btn-wrap_.location-btn]:[position:relative] [&_.btn-wrap_.address-btn]:[width:332rpx] [&_.btn-wrap_.address-btn]:[height:88rpx] [&_.btn-wrap_.address-btn]:[display:flex] [&_.btn-wrap_.address-btn]:[justify-content:center] [&_.btn-wrap_.address-btn]:[align-items:center] [&_.btn-wrap_.address-btn]:[background-color:#fa4126] [&_.btn-wrap_.address-btn]:[border-radius:44rpx] [&_.btn-wrap_.address-btn]:[color:#fff] [&_.btn-wrap_.btn-default]:[background:#c6c6c6] [&_.bottom-fixed_.footer]:[margin-top:10rpx] [&_.bottom-fixed_.footer]:[display:inline-block] [&_.bottom-fixed_.footer]:[width:100%] [&_.bottom-fixed_.footer]:[text-align:center] [&_.bottom-fixed_.footer]:[font-size:24rpx] [&_.bottom-fixed_.footer]:[font-weight:400] [&_.bottom-fixed_.footer]:[color:#ff2525] [&_.bottom-fixed_.footer]:[line-height:60rpx] [&_.bottom-fixed_.footer]:[height:60rpx] [&_.message]:[margin-top:48rpx] [&_.custom-class]:[margin-right:12rpx] [&_.custom-class]:[font-weight:normal]">
  <view class="address-list [&_.no-address]:[width:750rpx] [&_.no-address]:[padding-top:30vh] [&_.no-address]:[display:flex] [&_.no-address]:[flex-direction:column] [&_.no-address]:[justify-content:flex-start] [&_.no-address]:[align-items:center] [&_.no-address__icon]:[width:224rpx] [&_.no-address__icon]:[height:224rpx] [&_.no-address__text]:[font-size:28rpx] [&_.no-address__text]:[line-height:40rpx] [&_.no-address__text]:[color:#999999] [&_.no-address__text]:[margin-top:24rpx]" wx:if="{{addressList.length > 0}}">
    <block wx:for="{{addressList}}" wx:for-index="index" wx:for-item="address" wx:key="addressId">
      <t-address-item
        isDrawLine="{{index+1 !== addressList.length}}"
        extra-space="{{extraSpace}}"
        class-prefix="ym"
        address="{{address}}"
        data-id="{{address.id}}"
        bind:onSelect="selectHandle"
        bind:onDelete="deleteAddressHandle"
        bind:onEdit="editAddressHandle"
      />
    </block>
  </view>
  <view wx:else class="no-address">
    <t-empty icon="" description="暂无收货地址，赶快添加吧" />
  </view>
  <view class="bottom-fixed">
    <view class="btn-wrap">
      <t-location
        title="微信地址导入"
        isOrderSure="{{isOrderSure}}"
        isDisabledBtn="{{addressList.length >= 20}}"
        navigateUrl="/pages/user/address/edit/index"
        navigateEvent="onWeixinAddressPassed"
        t-class="location-btn"
        isCustomStyle="{{true}}"
        bind:navigate="waitForNewAddress"
      />
      <view class="address-btn {{addressList.length >= 20 ? 'btn-default':''}}" bind:tap="createHandle">
        <t-icon name="add" size="48rpx" color="#fff" t-class="custom-class" />
        <text>新建收货地址</text>
      </view>
    </view>
    <view class="footer" wx:if="{{addressList.length >= 20}}">最多支持添加20个收货地址</view>
  </view>
</view>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "收货地址",
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-image": "/components/webp-image/index",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-address-item": "/pages/user/components/ui-address-item/index",
    "t-location": "/pages/user/components/t-location/index",
    "t-empty": "tdesign-miniprogram/empty/empty"
  }
}
</json>
