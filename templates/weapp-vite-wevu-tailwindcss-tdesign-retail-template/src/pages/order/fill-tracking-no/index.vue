<script setup lang="ts">
import Dialog from 'tdesign-miniprogram/dialog/index';
import Toast from 'tdesign-miniprogram/toast/index';
import reasonSheet from '../components/reason-sheet/reasonSheet';
import { getDeliverCompanyList, create, update } from './api';
defineOptions({
  deliveryCompanyList: [],
  data() {
    return {
      trackingNo: '',
      remark: '',
      deliveryCompany: null,
      submitActived: false,
      submitting: false
    };
  },
  onLoad(query) {
    const {
      rightsNo = '',
      logisticsNo = '',
      logisticsCompanyName = '',
      logisticsCompanyCode = '',
      remark = ''
    } = query;
    if (!rightsNo) {
      Dialog.confirm({
        title: '请选择售后单？',
        content: '',
        confirmBtn: '确认'
      }).then(() => {
        wx.navigateBack({
          backRefresh: true
        });
      });
    }
    this.rightsNo = rightsNo;
    if (logisticsNo) {
      wx.setNavigationBarTitle({
        title: '修改运单号',
        fail() {}
      });
      this.isChange = true;
      this.setData({
        deliveryCompany: {
          name: logisticsCompanyName,
          code: logisticsCompanyCode
        },
        trackingNo: logisticsNo,
        remark,
        submitActived: true
      });
    }
    this.setWatcher('trackingNo', this.checkParams.bind(this));
    this.setWatcher('deliveryCompany', this.checkParams.bind(this));
  },
  setWatcher(key, callback) {
    let lastData = this.data;
    const keys = key.split('.');
    keys.slice(0, -1).forEach(k => {
      lastData = lastData[k];
    });
    const lastKey = keys[keys.length - 1];
    this.observe(lastData, lastKey, callback);
  },
  observe(data, k, callback) {
    let val = data[k];
    Object.defineProperty(data, k, {
      configurable: true,
      enumerable: true,
      set: value => {
        val = value;
        callback();
      },
      get: () => {
        return val;
      }
    });
  },
  getDeliveryCompanyList() {
    if (this.deliveryCompanyList.length > 0) {
      return Promise.resolve(this.deliveryCompanyList);
    }
    return getDeliverCompanyList().then(res => {
      this.deliveryCompanyList = res.data || [];
      return this.deliveryCompanyList;
    });
  },
  onInput(e) {
    const {
      key
    } = e.currentTarget.dataset;
    const {
      value
    } = e.detail;
    this.setData({
      [key]: value
    });
  },
  onCompanyTap() {
    this.getDeliveryCompanyList().then(deliveryCompanyList => {
      reasonSheet({
        show: true,
        title: '选择物流公司',
        options: deliveryCompanyList.map(company => ({
          title: company.name,
          checked: this.data.deliveryCompany ? company.code === this.data.deliveryCompany.code : false
        })),
        showConfirmButton: true,
        showCancelButton: true,
        emptyTip: '请选择物流公司'
      }).then(indexes => {
        this.setData({
          deliveryCompany: deliveryCompanyList[indexes[0]]
        });
      });
    });
  },
  checkParams() {
    const res = {
      errMsg: '',
      require: false
    };
    if (!this.data.trackingNo) {
      res.errMsg = '请填写运单号';
      res.require = true;
    } else if (!this.data.deliveryCompany) {
      res.errMsg = '请选择物流公司';
      res.require = true;
    }
    this.setData({
      submitActived: !res.require
    });
    return res;
  },
  onSubmit() {
    const checkRes = this.checkParams();
    if (checkRes.errMsg) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: checkRes.errMsg,
        icon: ''
      });
      return;
    }
    const {
      trackingNo,
      remark,
      deliveryCompany: {
        code,
        name
      }
    } = this.data;
    const params = {
      rightsNo: this.rightsNo,
      logisticsCompanyCode: code,
      logisticsCompanyName: name,
      logisticsNo: trackingNo,
      remark
    };
    const api = this.isChange ? create : update;
    this.setData({
      submitting: true
    });
    api(params).then(() => {
      this.setData({
        submitting: false
      });
      Toast({
        context: this,
        selector: '#t-toast',
        message: '保存成功',
        icon: ''
      });
      setTimeout(() => wx.navigateBack({
        backRefresh: true
      }), 1000);
    }).catch(() => {
      this.setData({
        submitting: false
      });
    });
  },
  onScanTap() {
    wx.scanCode({
      scanType: ['barCode'],
      success: res => {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '扫码成功',
          icon: ''
        });
        this.setData({
          trackingNo: res.result
        });
      },
      fail: () => {}
    });
  }
});
</script>

<template>
<view class="fill-tracking-no">
  <view class="notice-bar [padding:24rpx_30rpx] [text-align:center] [font-size:26rpx] [color:#e17349] [background:#fefcef]">请填写正确的退货包裹运单信息，以免影响退款进度</view>
  <view class="fill-tracking-no__form [margin-top:20rpx] [--td-input-vertical-padding:0] [&_.t-cell__note]:[justify-content:flex-start] [&_.t-cell__note]:[width:340rpx] [&_.t-cell__note]:[margin-left:10rpx] [&_.t-cell__value]:[color:#333] [&_.t-cell__value]:[font-size:30rpx] [&_.t-cell__value]:[text-align:left] [&_.t-cell__value]:[padding:0] [&_.t-cell__value_.t-textarea__wrapper]:[padding:0] [&_.t-input__control]:[font-size:30rpx] [&_.t-textarea__placeholder]:[font-size:30rpx] [&_.t-cell__placeholder]:[font-size:30rpx] [&_.t-textarea__placeholder]:[color:#bbbbbb] [&_.t-cell__placeholder]:[color:#bbbbbb] [&_.t-input__wrapper]:[margin:0]">
    <t-cell-group>
      <t-cell title="运单号" t-class-title="t-cell-title-width">
        <t-input
          slot="note"
          borderless
          t-class="t-cell__value"
          type="text"
          value="{{trackingNo}}"
          maxlength="30"
          placeholder="请输入物流单号"
          bind:change="onInput"
          data-key="trackingNo"
        />

        <t-icon slot="right-icon" name="scan" t-class="icon-scan" bindtap="onScanTap" />
      </t-cell>
      <t-cell
        t-class-title="t-cell-title-width"
        t-class-note="{{deliveryCompany && deliveryCompany.name ? 't-cell__value' : 't-cell__placeholder'}}"
        title="物流公司"
        note="{{deliveryCompany && deliveryCompany.name || '请选择物流公司'}}"
        arrow
        bindtap="onCompanyTap"
      />
    </t-cell-group>
    <view class="textarea-wrapper [background:#fff] [display:flex] [align-items:flex-start] [padding:24rpx_32rpx_0_32rpx]">
      <text>备注信息</text>
    </view>
    <t-textarea
      t-class="t-textarea-wrapper [box-sizing:border-box]"
      type="text"
      value="{{remark}}"
      maxlength="140"
      autosize
      placeholder="选填项，如有多个包裹寄回，请注明其运单信息"
      bind:change="onInput"
      data-key="remark"
    />
  </view>
  <view class="fill-tracking-no__button-bar [margin:38rpx_30rpx_0] [&_.btn]:[background-color:transparent] [&_.btn]:[font-size:32rpx] [&_.btn]:[width:100%] [&_.btn]:[border-radius:48rpx] [&_.btn:first-child]:[margin-bottom:20rpx] [&_.btn_.confirmBtn]:[background:#fa4126] [&_.btn_.confirmBtn]:[color:#fff] [&_.btn_.disabled]:[background-color:#c6c6c6] [&_.btn_.disabled]:[color:#fff]">
    <t-button
      t-class="btn {{ submitActived ? 'confirmBtn' : '' }}"
      disabled="{{!submitActived}}"
      loading="{{submitting}}"
      bindtap="onSubmit"
    >
      保存
    </t-button>
  </view>
</view>
<ui-reason-sheet id="wr-reason-sheet" />
<t-toast id="t-toast" />
<t-dialog id="t-dialog" />
</template>

<json>
{
  "navigationBarTitleText": "填写运单号",
  "usingComponents": {
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-textarea": "tdesign-miniprogram/textarea/textarea",
    "t-input": "tdesign-miniprogram/input/input",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-button": "tdesign-miniprogram/button/button",
    "ui-reason-sheet": "../components/reason-sheet/index"
  }
}</json>
