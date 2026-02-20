<script lang="ts">
import Toast from 'tdesign-miniprogram/toast/index';
import { fetchDeliveryAddress } from '../../../../services/address/fetchAddress';
import { areaData } from '../../../../config/index';
import { resolveAddress, rejectAddress } from '../../../../services/address/list';

const innerPhoneReg = '^1(?:3\\d|4[4-9]|5[0-35-9]|6[67]|7[0-8]|8\\d|9\\d)\\d{8}$';
const innerNameReg = '^[a-zA-Z\\d\\u4e00-\\u9fa5]+$';
const labelsOptions = [
  { id: 0, name: '家' },
  { id: 1, name: '公司' },
];

Page({
  options: {
    multipleSlots: true,
  },
  externalClasses: ['theme-wrapper-class'],
  data: {
    locationState: {
      labelIndex: null,
      addressId: '',
      addressTag: '',
      cityCode: '',
      cityName: '',
      countryCode: '',
      countryName: '',
      detailAddress: '',
      districtCode: '',
      districtName: '',
      isDefault: false,
      name: '',
      phone: '',
      provinceCode: '',
      provinceName: '',
      isEdit: false,
      isOrderDetail: false,
      isOrderSure: false,
    },
    areaData: areaData,
    labels: labelsOptions,
    areaPickerVisible: false,
    submitActive: false,
    visible: false,
    labelValue: '',
    columns: 3,
  },
  privateData: {
    verifyTips: '',
  },
  onLoad(options) {
    const { id } = options;
    this.init(id);
  },

  onUnload() {
    if (!this.hasSava) {
      rejectAddress();
    }
  },

  hasSava: false,

  init(id) {
    if (id) {
      this.getAddressDetail(Number(id));
    }
  },
  getAddressDetail(id) {
    fetchDeliveryAddress(id).then((detail) => {
      this.setData({ locationState: detail }, () => {
        const { isLegal, tips } = this.onVerifyInputLegal();
        this.setData({
          submitActive: isLegal,
        });
        this.privateData.verifyTips = tips;
      });
    });
  },
  onInputValue(e) {
    const { item } = e.currentTarget.dataset;
    if (item === 'address') {
      const { selectedOptions = [] } = e.detail;
      this.setData(
        {
          'locationState.provinceCode': selectedOptions[0].value,
          'locationState.provinceName': selectedOptions[0].label,
          'locationState.cityName': selectedOptions[1].label,
          'locationState.cityCode': selectedOptions[1].value,
          'locationState.districtCode': selectedOptions[2].value,
          'locationState.districtName': selectedOptions[2].label,
          areaPickerVisible: false,
        },
        () => {
          const { isLegal, tips } = this.onVerifyInputLegal();
          this.setData({
            submitActive: isLegal,
          });
          this.privateData.verifyTips = tips;
        },
      );
    } else {
      const { value = '' } = e.detail;
      this.setData(
        {
          [`locationState.${item}`]: value,
        },
        () => {
          const { isLegal, tips } = this.onVerifyInputLegal();
          this.setData({
            submitActive: isLegal,
          });
          this.privateData.verifyTips = tips;
        },
      );
    }
  },
  onPickArea() {
    this.setData({ areaPickerVisible: true });
  },
  onPickLabels(e) {
    const { item } = e.currentTarget.dataset;
    const {
      locationState: { labelIndex = undefined },
      labels = [],
    } = this.data;
    let payload = {
      labelIndex: item,
      addressTag: labels[item].name,
    };
    if (item === labelIndex) {
      payload = { labelIndex: null, addressTag: '' };
    }
    this.setData({
      'locationState.labelIndex': payload.labelIndex,
    });
    this.triggerEvent('triggerUpdateValue', payload);
  },
  addLabels() {
    this.setData({
      visible: true,
    });
  },
  confirmHandle() {
    const { labels, labelValue } = this.data;
    this.setData({
      visible: false,
      labels: [...labels, { id: labels[labels.length - 1].id + 1, name: labelValue }],
      labelValue: '',
    });
  },
  cancelHandle() {
    this.setData({
      visible: false,
      labelValue: '',
    });
  },
  onCheckDefaultAddress({ detail }) {
    const { value } = detail;
    this.setData({
      'locationState.isDefault': value,
    });
  },

  onVerifyInputLegal() {
    const { name, phone, detailAddress, districtName } = this.data.locationState;
    const prefixPhoneReg = String(this.properties.phoneReg || innerPhoneReg);
    const prefixNameReg = String(this.properties.nameReg || innerNameReg);
    const nameRegExp = new RegExp(prefixNameReg);
    const phoneRegExp = new RegExp(prefixPhoneReg);

    if (!name || !name.trim()) {
      return {
        isLegal: false,
        tips: '请填写收货人',
      };
    }
    if (!nameRegExp.test(name)) {
      return {
        isLegal: false,
        tips: '收货人仅支持输入中文、英文（区分大小写）、数字',
      };
    }
    if (!phone || !phone.trim()) {
      return {
        isLegal: false,
        tips: '请填写手机号',
      };
    }
    if (!phoneRegExp.test(phone)) {
      return {
        isLegal: false,
        tips: '请填写正确的手机号',
      };
    }
    if (!districtName || !districtName.trim()) {
      return {
        isLegal: false,
        tips: '请选择省市区信息',
      };
    }
    if (!detailAddress || !detailAddress.trim()) {
      return {
        isLegal: false,
        tips: '请完善详细地址',
      };
    }
    if (detailAddress && detailAddress.trim().length > 50) {
      return {
        isLegal: false,
        tips: '详细地址不能超过50个字符',
      };
    }
    return {
      isLegal: true,
      tips: '添加成功',
    };
  },

  builtInSearch({ code, name }) {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting[code] === false) {
            wx.showModal({
              title: `获取${name}失败`,
              content: `获取${name}失败，请在【右上角】-小程序【设置】项中，将【${name}】开启。`,
              confirmText: '去设置',
              confirmColor: '#FA550F',
              cancelColor: '取消',
              success(res) {
                if (res.confirm) {
                  wx.openSetting({
                    success(settinRes) {
                      if (settinRes.authSetting[code] === true) {
                        resolve();
                      } else {
                        console.warn('用户未打开权限', name, code);
                        reject();
                      }
                    },
                  });
                } else {
                  reject();
                }
              },
              fail() {
                reject();
              },
            });
          } else {
            resolve();
          }
        },
        fail() {
          reject();
        },
      });
    });
  },

  onSearchAddress() {
    this.builtInSearch({ code: 'scope.userLocation', name: '地址位置' }).then(() => {
      wx.chooseLocation({
        success: (res) => {
          if (res.name) {
            this.triggerEvent('addressParse', {
              address: res.address,
              name: res.name,
              latitude: res.latitude,
              longitude: res.longitude,
            });
          } else {
            Toast({
              context: this,
              selector: '#t-toast',
              message: '地点为空，请重新选择',
              icon: '',
              duration: 1000,
            });
          }
        },
        fail: function (res) {
          console.warn(`wx.chooseLocation fail: ${JSON.stringify(res)}`);
          if (res.errMsg !== 'chooseLocation:fail cancel') {
            Toast({
              context: this,
              selector: '#t-toast',
              message: '地点错误，请重新选择',
              icon: '',
              duration: 1000,
            });
          }
        },
      });
    });
  },
  formSubmit() {
    const { submitActive } = this.data;
    if (!submitActive) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: this.privateData.verifyTips,
        icon: '',
        duration: 1000,
      });
      return;
    }
    const { locationState } = this.data;

    this.hasSava = true;

    resolveAddress({
      saasId: '88888888',
      uid: `88888888205500`,
      authToken: null,
      id: locationState.addressId,
      addressId: locationState.addressId,
      phone: locationState.phone,
      name: locationState.name,
      countryName: locationState.countryName,
      countryCode: locationState.countryCode,
      provinceName: locationState.provinceName,
      provinceCode: locationState.provinceCode,
      cityName: locationState.cityName,
      cityCode: locationState.cityCode,
      districtName: locationState.districtName,
      districtCode: locationState.districtCode,
      detailAddress: locationState.detailAddress,
      isDefault: locationState.isDefault === 1 ? 1 : 0,
      addressTag: locationState.addressTag,
      latitude: locationState.latitude,
      longitude: locationState.longitude,
      storeId: null,
    });

    wx.navigateBack({ delta: 1 });
  },

  getWeixinAddress(e) {
    const { locationState } = this.data;
    const weixinAddress = e.detail;
    this.setData(
      {
        locationState: { ...locationState, ...weixinAddress },
      },
      () => {
        const { isLegal, tips } = this.onVerifyInputLegal();
        this.setData({
          submitActive: isLegal,
        });
        this.privateData.verifyTips = tips;
      },
    );
  },
});
</script>

<template>
<view class="address-detail [font-size:30rpx]">
  <view class="divider-line [width:100%] [height:20rpx] [background-color:#f5f5f5]" />
  <t-location
    title="获取微信收获地址"
    isCustomStyle
    t-class="address-detail-wx-location [background:#fff] [padding:24rpx_32rpx] [display:flex] [align-items:center] [justify-content:space-between]"
    bind:change="getWeixinAddress"
  >
    <t-icon class="address-detail-wx-arrow [align-items:flex-end]" name="arrow_forward" prefix="wr" color="#bbb" size="32rpx" />
  </t-location>
  <view class="divider-line [width:100%] [height:20rpx] [background-color:#f5f5f5]" />
  <view class="form-address [&_.map]:[font-size:48rpx] [&_.map]:[margin-left:20rpx] [&_.map]:[color:#9d9d9f] [&_.label-list]:[background:#f5f5f5] [&_.label-list]:[color:#333] [&_.label-list]:[min-width:100rpx] [&_.label-list]:[margin-right:32rpx] [&_.label-list]:[font-size:26rpx] [&_.label-list]:[border:2rpx_solid_transparent] [&_.label-list]:[width:auto] [&_.active-btn]:[color:#fa4126] [&_.active-btn]:[border:2rpx_solid_#fa4126] [&_.active-btn]:[background:rgba(255,_95,_21,_0.04)]">
    <form class="form-content">
      <t-cell-group>
        <t-cell class="form-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]" t-class-title="t-cell-title" title="收货人" t-class-note="t-cell-note">
          <t-input
            class="t-input"
            slot="note"
            t-class="field-text"
            borderless
            data-item="name"
            maxlength="20"
            type="text"
            value="{{locationState.name}}"
            placeholder="您的姓名"
            bind:change="onInputValue"
          />
        </t-cell>
        <t-cell class="form-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]" t-class-title="t-cell-title" title="手机号">
          <t-input
            slot="note"
            class="t-input"
            t-class="field-text"
            borderless
            type="number"
            value="{{locationState.phone}}"
            maxlength="11"
            placeholder="联系您的手机号"
            bind:change="onInputValue"
            data-item="phone"
          />
        </t-cell>
        <t-cell class="form-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]" t-class-title="t-cell-title" title="地区">
          <t-input
            slot="note"
            class="t-input"
            t-class="field-text"
            borderless
            placeholder="省/市/区"
            data-item="address"
            value="{{locationState.provinceName ? locationState.provinceName+'/':'' }}{{locationState.cityName ? locationState.cityName+'/':''}}{{locationState.districtName}}"
            catch:tap="onPickArea"
            disabled
          />
          <t-icon slot="right-icon" t-class="map" prefix="wr" name="location" catch:tap="onSearchAddress" />
        </t-cell>
        <t-cell class="form-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]" t-class-title="t-cell-title" title="详细地址" bordered="{{false}}">
          <view slot="note" class="textarea__wrapper [width:100%] [&_.t-textarea]:[padding:0]">
            <t-textarea
              slot="note"
              type="text"
              value="{{locationState.detailAddress}}"
              placeholder="门牌号等(例如:10栋1001号)"
              autosize
              bind:change="onInputValue"
              data-item="detailAddress"
            />
          </view>
        </t-cell>

        <view class="divider-line [width:100%] [height:20rpx] [background-color:#f5f5f5]" />
        <t-cell
          class="form-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]"
          t-class-note="t-cell-note address__tag"
          t-class-title="t-cell-title"
          title="标签"
          bordered="{{false}}"
        >
          <view class="t-input address-flex-box [display:flex] [flex-wrap:wrap]" slot="note">
            <t-button
              wx:for="{{labels}}"
              wx:for-item="label"
              wx:key="index"
              size="extra-small"
              t-class="label-list {{locationState.labelIndex === index ? 'active-btn':''}}"
              bindtap="onPickLabels"
              data-item="{{index}}"
            >
              {{label.name}}
            </t-button>
            <t-button size="extra-small" t-class="label-list" bindtap="addLabels">
              <t-icon name="add" size="40rpx" color="#bbb" />
            </t-button>
          </view>
        </t-cell>
        <view class="divider-line [width:100%] [height:20rpx] [background-color:#f5f5f5]" />
        <t-cell title="设置为默认收货地址" bordered="{{false}}">
          <t-switch
            value="{{locationState.isDefault}}"
            slot="note"
            colors="{{['#0ABF5B', '#c6c6c6']}}"
            bind:change="onCheckDefaultAddress"
          />
        </t-cell>
      </t-cell-group>
      <view class="submit [box-sizing:border-box] [padding:64rpx_30rpx_88rpx_30rpx] [&_.btn-submit-address]:[background:#fa4126] [&_.btn-submit-address]:[color:#fff]">
        <t-button shape="round" block disabled="{{!submitActive}}" bind:tap="formSubmit"> 保存 </t-button>
      </view>
    </form>
  </view>
  <t-cascader
    data-item="address"
    data-type="1"
    visible="{{areaPickerVisible}}"
    theme="tab"
    options="{{areaData}}"
    value="{{locationState.districtCode}}"
    title="选择地区"
    bind:change="onInputValue"
  ></t-cascader>
</view>
<t-dialog
  visible="{{visible}}"
  t-class-confirm="dialog__button-confirm"
  t-class-cancel="dialog__button-cancel"
  title="填写标签名称"
  confirm-btn="确定"
  cancel-btn="取消"
  bind:confirm="confirmHandle"
  bind:cancel="cancelHandle"
>
  <t-input slot="content" class="dialog__input [margin-top:32rpx] [border-radius:8rpx] [box-sizing:border-box] [--td-input-vertical-padding:12px] [--td-input-bg-color:#f3f3f3]" model:value="{{labelValue}}" placeholder="请输入标签名称" borderless />
</t-dialog>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "添加新地址",
  "usingComponents": {
    "t-textarea": "tdesign-miniprogram/textarea/textarea",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-input": "tdesign-miniprogram/input/input",
    "t-button": "tdesign-miniprogram/button/button",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-switch": "tdesign-miniprogram/switch/switch",
    "t-location": "/pages/user/components/t-location/index",
    "t-cascader": "tdesign-miniprogram/cascader/cascader"
  }
}
</json>
