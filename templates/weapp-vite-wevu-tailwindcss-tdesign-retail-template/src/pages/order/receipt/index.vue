<script lang="ts">
/* eslint-disable no-nested-ternary */
import Dialog from 'tdesign-miniprogram/dialog/index';
import Toast from 'tdesign-miniprogram/toast/index';
import { dispatchSupplementInvoice } from '../../../services/order/orderConfirm';

const invoiceJson = {
  info: [
    '1.根据当地税务局的要求，开具有效的企业发票需填写税务局登记证号。开具个人发票不需要填写纳税人识别码。 ',
    '2.电子普通发票： 电子普通发票是税局认可的有效首付款凭证，其法律效力、基本用途及使用规定同纸质发票，如需纸质发票可自行下载打印。 ',
    '3.增值税专用发票： 增值税发票暂时不可开，可查看《开局增值税发票》或致电400-633-6868。',
  ],
  codeTitle: [
    '1.什么是纳税人识别号/统一社会信用代码？ 纳税人识别号，一律由15位、17位、18或者20位码（字符型）组成，其中：企业、事业单位等组织机构纳税人，以国家质量监督检验检疫总局编制的9位码（其中区分主码位与校检位之间的“—”符省略不打印）并在其“纳税人识别号”。国家税务总局下达的纳税人代码为15位，其中：1—2位为省、市代码，3—6位为地区代码，7—8位为经济性质代码，9—10位行业代码，11—15位为各地区自设的顺序码。',
    '2.入户获取/知晓纳税人识别号/统一社会信用代码？ 纳税人识别号是税务登记证上的号码，通常简称为“税号”，每个企业的纳税人识别号都是唯一的。这个属于每个人自己且终身不变的数字代码很可能成为我们的第二张“身份证”。  ',
  ],
};

Page({
  orderNo: '',
  data: {
    receiptIndex: 0,
    addressTagsIndex: 0,
    goodsClassesIndex: 0,
    dialogShow: false,
    codeShow: false,
    receipts: [
      { title: '不开发票', id: 0, name: 'receipt' },
      { title: '电子发票', id: 1, name: 'receipt' },
    ],
    addressTags: [
      { title: '个人', id: 0, name: 'addressTags', type: 1 },
      { title: '公司', id: 1, name: 'addressTags', type: 2 },
    ],
    goodsClasses: [
      { title: '商品明细', id: 0, name: 'goodsClasses' },
      { title: '商品类别', id: 1, name: 'goodsClasses' },
    ],
    name: '',
    componentName: '',
    code: '',
    phone: '',
    email: '',
    invoiceInfo: invoiceJson,
  },
  onLoad(query) {
    const { orderNo, invoiceData } = query;
    const tempData = JSON.parse(invoiceData || '{}');
    const invoice = {
      receiptIndex: tempData.invoiceType === 5 ? 1 : 0,
      name: tempData.buyerName || '',
      email: tempData.email || '',
      phone: tempData.buyerPhone || '',
      addressTagsIndex: tempData.titleType === 2 ? 1 : 0,
      goodsClassesIndex: tempData.contentType === 2 ? 1 : 0,
      code: tempData.buyerTaxNo || '',
      componentName: tempData.titleType === 2 ? tempData.buyerName : '',
    };
    this.orderNo = orderNo;
    this.setData({ ...invoice });
  },
  onLabels(e) {
    const { item } = e.currentTarget.dataset;
    const nameIndex = `${item.name}Index`;
    this.setData({ [nameIndex]: item.id });
  },
  onInput(e) {
    const { addressTagsIndex } = this.data;
    const { item } = e.currentTarget.dataset;
    const { value } = e.detail;
    const key =
      item === 'name'
        ? addressTagsIndex === 0
          ? 'name'
          : 'componentName'
        : item === 'code'
        ? addressTagsIndex === 0
          ? 'phone'
          : 'code'
        : 'email';
    this.setData({ [key]: value });
  },
  onSure() {
    const result = this.checkSure();
    if (!result) {
      Dialog.alert({
        title: '请填写发票信息',
        content: '',
        confirmBtn: '确认',
      });
      return;
    }
    const {
      receiptIndex,
      addressTagsIndex,
      receipts,
      addressTags,
      name,
      componentName,
      code,
      phone,
      email,
      goodsClassesIndex,
    } = this.data;

    const data = {
      buyerName: addressTagsIndex === 0 ? name : componentName,
      buyerTaxNo: code,
      buyerPhone: phone,
      email,
      titleType: addressTags[addressTagsIndex].type,
      contentType: goodsClassesIndex === 0 ? 1 : 2,
      invoiceType: receiptIndex === 1 ? 5 : 0,
    };
    if (this.orderNo) {
      if (this.submitting) return;
      const params = {
        parameter: {
          orderNo: this.orderNo,
          invoiceVO: data,
        },
      };
      this.submitting = true;
      dispatchSupplementInvoice(params)
        .then(() => {
          Toast({
            context: this,
            selector: '#t-toast',
            message: '保存成功',
            duration: 2000,
            icon: '',
          });
          setTimeout(() => {
            this.submitting = false;
            wx.navigateBack({ delta: 1 });
          }, 1000);
        })
        .catch((err) => {
          this.submitting = false;
          console.error(err);
        });
    } else {
      Object.assign(data, {
        receipts: receipts[receiptIndex],
        addressTags: addressTags[addressTagsIndex],
      });
      wx.setStorageSync('invoiceData', data);
      wx.navigateBack({ delta: 1 });
    }
  },
  checkSure() {
    const { name, componentName, code, phone, email, addressTagsIndex, receiptIndex } = this.data;
    if (receiptIndex === 0) {
      return true;
    }
    if (addressTagsIndex === 0) {
      if (!name.length || !phone.length) {
        return false;
      }
    } else if (addressTagsIndex === 1) {
      if (!componentName.length || !code.length) {
        return false;
      }
    }
    if (!email.length) {
      return false;
    }
    return true;
  },
  onDialogTap() {
    const { dialogShow } = this.data;
    this.setData({
      dialogShow: !dialogShow,
      codeShow: false,
    });
  },
  onKnowCode() {
    this.setData({
      dialogShow: !this.data.dialogShow,
      codeShow: true,
    });
  },
});
</script>

<template>
<view class="receipt [height:100vh] [background:#f5f5f5] [position:relative] [padding-top:20rpx] [&_.t-input__wrapper]:[margin:0] [&_.flex]:[display:flex] [&_.flex]:[align-items:center] [&_.flex]:[justify-content:space-between] [&_.head-title]:[color:#333] [&_.head-title]:[font-size:30rpx] [&_.head-title]:[font-weight:bold] [&_.btn-wrap]:[display:flex] [&_.btn-wrap_.btn]:[width:128rpx] [&_.btn-wrap_.btn]:[background:#f5f5f5] [&_.btn-wrap_.btn]:[font-size:24rpx] [&_.btn-wrap_.btn]:[color:#333] [&_.btn-wrap_.btn]:[margin-right:22rpx] [&_.btn-wrap_.btn]:[text-align:center] [&_.btn-wrap_.btn]:[border-radius:8rpx] [&_.btn-wrap_.btn]:[position:relative] [&_.btn-wrap_.btn]:[border:2rpx_solid_#f5f5f5] [&_.btn-wrap_.active-btn]:[background-color:transparent] [&_.btn-wrap_.active-btn]:[border-color:#fa4126] [&_.btn-wrap_.active-btn]:[color:#fa4126] [&_.title]:[width:100%] [&_.title]:[background-color:#fff] [&_.title]:[margin-bottom:20rpx] [&_.receipt-label]:[display:flex] [&_.receipt-label_.btn]:[width:128rpx] [&_.receipt-label_.btn]:[background:#f5f5f5] [&_.receipt-label_.btn]:[font-size:24rpx] [&_.receipt-label_.btn]:[color:#333] [&_.receipt-label_.btn]:[margin-left:22rpx] [&_.receipt-label_.btn]:[text-align:center] [&_.receipt-label_.btn]:[border-radius:8rpx] [&_.receipt-label_.btn]:[border:2rpx_solid_#f5f5f5] [&_.receipt-label_.active-btn]:[background-color:transparent] [&_.receipt-label_.active-btn]:[border-color:#fa4126] [&_.receipt-label_.active-btn]:[color:#fa4126] [&_.receipt-label_.wr-cell__title]:[font-size:30rpx] [&_.receipt-label_.wr-cell__title]:[color:#333] [&_.receipt-label_.wr-cell__title]:[font-weight:bold] [&_.receipt-content]:[background:#fff] [&_.receipt-content]:[margin-top:20rpx] [&_.receipt-content_.addressTags]:[padding:0_30rpx] [&_.receipt-content_.addressTags]:[height:100rpx] [&_.receipt-content_.addressTags_.btn-wrap]:[display:flex] [&_.receipt-content_.line]:[width:720rpx] [&_.receipt-content_.line]:[margin-left:30rpx] [&_.receipt-content_.line]:[background-color:#e6e6e6] [&_.receipt-content_.line]:[height:1rpx] [&_.receipt-content_.receipt-input]:[display:flex] [&_.receipt-content_.receipt-input]:[padding:0_30rpx] [&_.receipt-content_.receipt-input]:[align-items:center] [&_.receipt-content_.receipt-input]:[height:100rpx] [&_.receipt-content_.receipt-input]:[color:#666] [&_.receipt-content_.receipt-input_.title]:[color:#333] [&_.receipt-content_.receipt-input_.title]:[display:inline-block] [&_.receipt-content_.receipt-input_.title]:[width:140rpx] [&_.receipt-content_.receipt-input_.title]:[margin-right:30rpx] [&_.receipt-content_.receipt-input_.title]:[font-size:30rpx] [&_.receipt-content_.receipt-input_.title]:[font-weight:bold] [&_.receipt-content_.receipt-input_.wr-icon]:[font-size:28rpx] [&_.receipt-content_.receipt-input_.wr-icon]:[margin-left:20rpx] [&_.receipt-info]:[background:#fff] [&_.receipt-info]:[margin-top:20rpx] [&_.receipt-info_.info-con]:[padding:0_30rpx] [&_.receipt-info_.info-con]:[height:100rpx] [&_.receipt-info_.title]:[font-size:24rpx] [&_.receipt-info_.title]:[color:#999999] [&_.receipt-info_.title]:[line-height:36rpx] [&_.receipt-info_.title]:[padding:0_30rpx_20rpx] [&_.receipt-info_.title]:[box-sizing:border-box] [&_.receipt-know]:[display:flex] [&_.receipt-know]:[align-items:center] [&_.receipt-know]:[font-size:26rpx] [&_.receipt-know]:[font-weight:400] [&_.receipt-know]:[color:#999999] [&_.receipt-know]:[padding:20rpx_30rpx] [&_.receipt-know]:[line-height:26rpx] [&_.receipt-know_.icon]:[margin-left:16rpx] [&_.receipt-know_.icon]:[font-size:26rpx] [&_.dialog-receipt_.dialog__message]:[padding:0] [&_.dialog-receipt_.dialog-info]:[max-height:622rpx] [&_.dialog-receipt_.info-wrap]:[padding:0_18rpx] [&_.dialog-receipt_.info_.title]:[display:inline-block] [&_.dialog-receipt_.info_.title]:[font-size:28rpx] [&_.dialog-receipt_.info_.title]:[font-weight:400] [&_.dialog-receipt_.info_.title]:[color:#999] [&_.dialog-receipt_.info_.title]:[line-height:40rpx] [&_.dialog-receipt_.info_.title]:[margin-bottom:40rpx] [&_.dialog-receipt_.info_.title]:[text-align:left] [&_.receipt-btn]:[position:fixed] [&_.receipt-btn]:[bottom:0] [&_.receipt-btn]:[left:0] [&_.receipt-btn]:[right:0] [&_.receipt-btn]:[z-index:100] [&_.receipt-btn]:[background:#fff] [&_.receipt-btn]:[width:100%] [&_.receipt-btn]:[padding:0_20rpx] [&_.receipt-btn]:[box-sizing:border-box] [&_.receipt-btn]:[padding-bottom:calc(20rpx_+_env(safe-area-inset-bottom))] [&_.receipt-btn_.receipt-btn-con]:[margin-top:20rpx] [&_.receipt-btn_.receipt-btn-con]:[display:inline-block] [&_.receipt-btn_.receipt-btn-con]:[width:100%] [&_.receipt-btn_.receipt-btn-con]:[line-height:80rpx] [&_.receipt-btn_.receipt-btn-con]:[background:#fa4126] [&_.receipt-btn_.receipt-btn-con]:[text-align:center] [&_.receipt-btn_.receipt-btn-con]:[color:#fff] [&_.receipt-btn_.receipt-btn-con]:[border-radius:48rpx]">
  <view class="title">
    <t-cell class="receipt-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]" title="发票" bordered="{{false}}" t-class-left="cell-left">
      <view slot="right-icon" class="btn-wrap">
        <view
          bindtap="onLabels"
          data-item="{{item}}"
          class="btn {{receiptIndex === index ? 'active-btn' : ''}}"
          wx:for="{{receipts}}"
          wx:for-item="item"
          wx:key="index"
        >
          {{item.title}}
        </view>
      </view>
    </t-cell>
  </view>
  <block wx:if="{{receiptIndex === 1}}">
    <t-cell class="receipt-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]" title="发票抬头" t-class-left="cell-left">
      <view class="btn-wrap" slot="right-icon">
        <view
          class="btn {{addressTagsIndex === index ? 'active-btn':'' }}"
          bindtap="onLabels"
          data-item="{{tag}}"
          wx:for="{{addressTags}}"
          wx:for-item="tag"
          wx:key="index"
        >
          {{tag.title}}
        </view>
      </view>
    </t-cell>
    <t-cell
      class="receipt-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]"
      title="{{addressTagsIndex === 0 ? '姓名':'公司名称'}}"
      t-class-left="cell-left"
      t-class-right="cell-right"
    >
      <t-input
        slot="right-icon"
        borderless
        t-class="input-com [display:inline-block] [flex:1] [font-size:30rpx] [font-weight:400] [line-height:30rpx] ![padding:0] [color:#666]"
        value="{{addressTagsIndex === 0 ? name:componentName}}"
        bindchange="onInput"
        data-item="name"
        type=""
        placeholder="{{addressTagsIndex === 0 ? '请输入您的姓名':'请输入公司名称'}}"
      />
    </t-cell>
    <t-cell
      class="receipt-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]"
      title="{{addressTagsIndex === 0 ? '手机号':'识别号'}}"
      t-class-left="cell-left"
      t-class-right="cell-right"
    >
      <view class="addressTagsIndex-cell [display:flex] [align-items:center] [justify-content:space-between] [width:100%]" slot="right-icon">
        <t-input
          t-class="input-com [display:inline-block] [flex:1] [font-size:30rpx] [font-weight:400] [line-height:30rpx] ![padding:0] [color:#666]"
          borderless
          value="{{addressTagsIndex === 0 ? phone:code}}"
          bindchange="onInput"
          data-item="code"
          type=""
          placeholder="{{addressTagsIndex === 0 ? '请输入您的手机号':'请输入纳税人识别号'}}"
        />
        <t-icon wx:if="{{addressTagsIndex === 1}}" name="help-circle" size="30rpx" bindtap="onKnowCode" />
      </view>
    </t-cell>
    <t-cell
      class="receipt-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]"
      title="电子邮箱"
      bordered="{{false}}"
      t-class-left="cell-left"
      t-class-right="cell-right"
    >
      <t-input
        slot="right-icon"
        t-class="input-com [display:inline-block] [flex:1] [font-size:30rpx] [font-weight:400] [line-height:30rpx] ![padding:0] [color:#666]"
        borderless
        value="{{email}}"
        bindchange="onInput"
        data-item="email"
        type=""
        placeholder="请输入邮箱用于接收电子发票"
      />
    </t-cell>
    <view class="receipt-info">
      <t-cell class="receipt-cell [&_.t-cell__title]:[width:144rpx] [&_.t-cell__title]:[padding-right:32rpx] [&_.t-cell__title]:[flex:none]" title="发票内容" bordered="{{false}}" t-class-left="cell-left">
        <view class="btn-wrap" slot="right-icon">
          <view
            class="btn {{goodsClassesIndex ===index ? 'active-btn':''}}"
            bindtap="onLabels"
            data-item="{{good}}"
            wx:for="{{goodsClasses}}"
            wx:for-item="good"
            wx:key="index"
          >
            {{good.title}}
          </view>
        </view>
      </t-cell>
      <view class="title">发票内容将显示详细商品名称与价格信息，发票金额为实际支付金额，不包含优惠等扣减金额</view>
    </view>
    <view class="receipt-know" bindtap="onDialogTap">
      发票须知
      <t-icon name="help-circle" size="30rpx" />
    </view>
    <t-dialog
      title="{{codeShow ? '纳税人识别号说明':'发票须知'}}"
      bindconfirm="onDialogTap"
      class="dialog-receipt"
      visible="{{dialogShow}}"
      confirm-btn="我知道了"
    >
      <view class="srcoll-view-wrap [margin-top:20rpx]" slot="content">
        <scroll-view class="dialog-info" scroll-x="{{false}}" scroll-y="{{true}}">
          <view class="info-wrap">
            <view class="info" wx:if="{{!codeShow}}">
              <view class="title" wx:for="{{invoiceInfo.info}}" wx:key="index" wx:for-item="item"> {{item}} </view>
            </view>
            <view class="info" wx:else>
              <view class="title" wx:for="{{invoiceInfo.codeTitle}}" wx:key="index" wx:for-item="item"> {{item}} </view>
            </view>
          </view>
        </scroll-view>
      </view>
    </t-dialog>
  </block>
  <view wx:else></view>
  <view class="safe-area-bottom receipt-btn">
    <t-button t-class="receipt-btn-con" bindtap="onSure">确定</t-button>
  </view>
</view>
<t-toast id="t-toast" />
<t-dialog id="t-dialog" />
</template>

<json>
{
  "navigationBarTitleText": "发票",
  "usingComponents": {
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-input": "tdesign-miniprogram/input/input",
    "t-button": "tdesign-miniprogram/button/button"
  }
}
</json>
