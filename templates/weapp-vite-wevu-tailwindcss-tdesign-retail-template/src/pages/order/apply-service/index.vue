<script lang="ts">
import Dialog from 'tdesign-miniprogram/dialog/index';
import Toast from 'tdesign-miniprogram/toast/index';
import { priceFormat } from '../../../utils/util';
import { OrderStatus, ServiceType, ServiceReceiptStatus } from '../config';
import reasonSheet from '../components/reason-sheet/reasonSheet';
import {
  fetchRightsPreview,
  dispatchConfirmReceived,
  fetchApplyReasonList,
  dispatchApplyService,
} from '../../../services/order/applyService';

Page({
  query: {},
  data: {
    uploading: false, // 凭证上传状态
    canApplyReturn: true, // 是否可退货
    goodsInfo: {},
    receiptStatusList: [
      { desc: '未收到货', status: ServiceReceiptStatus.NOT_RECEIPTED },
      { desc: '已收到货', status: ServiceReceiptStatus.RECEIPTED },
    ],
    applyReasons: [],
    serviceType: null, // 20-仅退款，10-退货退款
    serviceFrom: {
      returnNum: 1,
      receiptStatus: { desc: '请选择', status: null },
      applyReason: { desc: '请选择', type: null },
      // max-填写上限(单位分)，current-当前值(单位分)，temp输入框中的值(单位元)
      amount: { max: 0, current: 0, temp: 0, focus: false },
      remark: '',
      rightsImageUrls: [],
    },
    maxApplyNum: 2, // 最大可申请售后的商品数
    amountTip: '',
    showReceiptStatusDialog: false,
    validateRes: {
      valid: false,
      msg: '',
    },
    submitting: false,
    inputDialogVisible: false,
    uploadGridConfig: {
      column: 3,
      width: 212,
      height: 212,
    },
    serviceRequireType: '',
  },

  setWatcher(key, callback) {
    let lastData = this.data;
    const keys = key.split('.');
    keys.slice(0, -1).forEach((k) => {
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
      set: (value) => {
        val = value;
        callback();
      },
      get: () => {
        return val;
      },
    });
  },

  validate() {
    let valid = true;
    let msg = '';
    // 检查必填项
    if (!this.data.serviceFrom.applyReason.type) {
      valid = false;
      msg = '请填写退款原因';
    } else if (!this.data.serviceFrom.amount.current) {
      valid = false;
      msg = '请填写退款金额';
    }
    if (this.data.serviceFrom.amount.current <= 0) {
      valid = false;
      msg = '退款金额必须大于0';
    }
    this.setData({ validateRes: { valid, msg } });
  },

  onLoad(query) {
    this.query = query;
    if (!this.checkQuery()) return;
    this.setData({
      canApplyReturn: query.canApplyReturn === 'true',
    });
    this.init();
    this.inputDialog = this.selectComponent('#input-dialog');
    this.setWatcher('serviceFrom.returnNum', this.validate.bind(this));
    this.setWatcher('serviceFrom.applyReason', this.validate.bind(this));
    this.setWatcher('serviceFrom.amount', this.validate.bind(this));
    this.setWatcher('serviceFrom.rightsImageUrls', this.validate.bind(this));
  },

  async init() {
    try {
      await this.refresh();
    } catch (e) {}
  },

  checkQuery() {
    const { orderNo, skuId } = this.query;
    if (!orderNo) {
      Dialog.alert({
        content: '请先选择订单',
      }).then(() => {
        wx.redirectTo({ url: 'pages/order/order-list/index' });
      });
      return false;
    }
    if (!skuId) {
      Dialog.alert({
        content: '请先选择商品',
      }).then(() => {
        wx.redirectTo(`pages/order/order-detail/index?orderNo=${orderNo}`);
      });
      return false;
    }
    return true;
  },

  async refresh() {
    wx.showLoading({ title: 'loading' });
    try {
      const res = await this.getRightsPreview();
      wx.hideLoading();
      const goodsInfo = {
        id: res.data.skuId,
        thumb: res.data.goodsInfo && res.data.goodsInfo.skuImage,
        title: res.data.goodsInfo && res.data.goodsInfo.goodsName,
        spuId: res.data.spuId,
        skuId: res.data.skuId,
        specs: ((res.data.goodsInfo && res.data.goodsInfo.specInfo) || []).map((s) => s.specValue),
        paidAmountEach: res.data.paidAmountEach,
        boughtQuantity: res.data.boughtQuantity,
      };
      this.setData({
        goodsInfo,
        'serviceFrom.amount': {
          max: res.data.refundableAmount,
          current: res.data.refundableAmount,
        },
        'serviceFrom.returnNum': res.data.numOfSku,
        amountTip: `最多可申请退款¥ ${priceFormat(res.data.refundableAmount, 2)}，含发货运费¥ ${priceFormat(
          res.data.shippingFeeIncluded,
          2,
        )}`,
        maxApplyNum: res.data.numOfSkuAvailable,
      });
    } catch (err) {
      wx.hideLoading();
      throw err;
    }
  },

  async getRightsPreview() {
    const { orderNo, skuId, spuId } = this.query;
    const params = {
      orderNo,
      skuId,
      spuId,
      numOfSku: this.data.serviceFrom.returnNum,
    };
    const res = await fetchRightsPreview(params);
    return res;
  },

  onApplyOnlyRefund() {
    wx.setNavigationBarTitle({ title: '申请退款' });
    this.setData({ serviceRequireType: 'REFUND_MONEY' });
    this.switchReceiptStatus(0);
  },

  onApplyReturnGoods() {
    wx.setNavigationBarTitle({ title: '申请退货退款' });
    this.setData({ serviceRequireType: 'REFUND_GOODS' });
    const orderStatus = parseInt(this.query.orderStatus);
    Promise.resolve()
      .then(() => {
        if (orderStatus === OrderStatus.PENDING_RECEIPT) {
          return Dialog.confirm({
            title: '订单商品是否已经收到货',
            content: '',
            confirmBtn: '确认收货，并申请退货',
            cancelBtn: '未收到货',
          }).then(() => {
            return dispatchConfirmReceived({
              parameter: {
                logisticsNo: this.query.logisticsNo,
                orderNo: this.query.orderNo,
              },
            });
          });
        }
        return;
      })
      .then(() => {
        this.setData({ serviceType: ServiceType.RETURN_GOODS });
        this.switchReceiptStatus(1);
      });
  },

  onApplyReturnGoodsStatus() {
    reasonSheet({
      show: true,
      title: '选择退款原因',
      options: this.data.applyReasons.map((r) => ({
        title: r.desc,
      })),
      showConfirmButton: true,
      showCancelButton: true,
      emptyTip: '请选择退款原因',
    }).then((indexes) => {
      this.setData({
        'serviceFrom.applyReason': this.data.applyReasons[indexes[0]],
      });
    });
  },

  onChangeReturnNum(e) {
    const { value } = e.detail;
    this.setData({
      'serviceFrom.returnNum': value,
    });
  },

  onApplyGoodsStatus() {
    reasonSheet({
      show: true,
      title: '请选择收货状态',
      options: this.data.receiptStatusList.map((r) => ({
        title: r.desc,
      })),
      showConfirmButton: true,
      emptyTip: '请选择收货状态',
    }).then((indexes) => {
      this.setData({
        'serviceFrom.receiptStatus': this.data.receiptStatusList[indexes[0]],
      });
    });
  },

  switchReceiptStatus(index) {
    const statusItem = this.data.receiptStatusList[index];
    // 没有找到对应的状态，则清空/初始化
    if (!statusItem) {
      this.setData({
        showReceiptStatusDialog: false,
        'serviceFrom.receiptStatus': { desc: '请选择', status: null },
        'serviceFrom.applyReason': { desc: '请选择', type: null }, // 收货状态改变时，初始化申请原因
        applyReasons: [],
      });
      return;
    }
    // 仅选中项与当前项不一致时，才切换申请原因列表applyReasons
    if (!statusItem || statusItem.status === this.data.serviceFrom.receiptStatus.status) {
      this.setData({ showReceiptStatusDialog: false });
      return;
    }
    this.getApplyReasons(statusItem.status).then((reasons) => {
      this.setData({
        showReceiptStatusDialog: false,
        'serviceFrom.receiptStatus': statusItem,
        'serviceFrom.applyReason': { desc: '请选择', type: null }, // 收货状态改变时，重置申请原因
        applyReasons: reasons,
      });
    });
  },

  getApplyReasons(receiptStatus) {
    const params = { rightsReasonType: receiptStatus };
    return fetchApplyReasonList(params)
      .then((res) => {
        return res.data.rightsReasonList.map((reason) => ({
          type: reason.id,
          desc: reason.desc,
        }));
      })
      .catch(() => {
        return [];
      });
  },

  onReceiptStatusDialogConfirm(e) {
    const { index } = e.currentTarget.dataset;
    this.switchReceiptStatus(index);
  },

  onAmountTap() {
    this.setData({
      'serviceFrom.amount.temp': priceFormat(this.data.serviceFrom.amount.current),
      'serviceFrom.amount.focus': true,
      inputDialogVisible: true,
    });
    this.inputDialog.setData({
      cancelBtn: '取消',
      confirmBtn: '确定',
    });
    this.inputDialog._onConfirm = () => {
      this.setData({
        'serviceFrom.amount.current': this.data.serviceFrom.amount.temp * 100,
      });
    };
    this.inputDialog._onCancel = () => {};
  },

  // 对输入的值进行过滤
  onAmountInput(e) {
    let { value } = e.detail;
    const regRes = value.match(/\d+(\.?\d*)?/); // 输入中，允许末尾为小数点
    value = regRes ? regRes[0] : '';
    this.setData({ 'serviceFrom.amount.temp': value });
  },

  // 失去焦点时，更严格的过滤并转化为float
  onAmountBlur(e) {
    let { value } = e.detail;
    const regRes = value.match(/\d+(\.?\d+)?/); // 失去焦点时，不允许末尾为小数点
    value = regRes ? regRes[0] : '0';
    value = parseFloat(value) * 100;
    if (value > this.data.serviceFrom.amount.max) {
      value = this.data.serviceFrom.amount.max;
    }
    this.setData({
      'serviceFrom.amount.temp': priceFormat(value),
      'serviceFrom.amount.focus': false,
    });
  },

  onAmountFocus() {
    this.setData({ 'serviceFrom.amount.focus': true });
  },

  onRemarkChange(e) {
    const { value } = e.detail;
    this.setData({
      'serviceFrom.remark': value,
    });
  },

  // 发起申请售后请求
  onSubmit() {
    this.submitCheck().then(() => {
      const params = {
        rights: {
          orderNo: this.query.orderNo,
          refundRequestAmount: this.data.serviceFrom.amount.current,
          rightsImageUrls: this.data.serviceFrom.rightsImageUrls,
          rightsReasonDesc: this.data.serviceFrom.applyReason.desc,
          rightsReasonType: this.data.serviceFrom.receiptStatus.status,
          rightsType: this.data.serviceType,
        },
        rightsItem: [
          {
            itemTotalAmount: this.data.goodsInfo.price * this.data.serviceFrom.returnNum,
            rightsQuantity: this.data.serviceFrom.returnNum,
            skuId: this.query.skuId,
            spuId: this.query.spuId,
          },
        ],
        refundMemo: this.data.serviceFrom.remark.current,
      };
      this.setData({ submitting: true });
      // 发起申请售后请求
      dispatchApplyService(params)
        .then((res) => {
          Toast({
            context: this,
            selector: '#t-toast',
            message: '申请成功',
            icon: '',
          });

          wx.redirectTo({
            url: `/pages/order/after-service-detail/index?rightsNo=${res.data.rightsNo}`,
          });
        })
        .then(() => this.setData({ submitting: false }))
        .catch(() => this.setData({ submitting: false }));
    });
  },

  submitCheck() {
    return new Promise((resolve) => {
      const { msg, valid } = this.data.validateRes;
      if (!valid) {
        Toast({
          context: this,
          selector: '#t-toast',
          message: msg,
          icon: '',
        });
        return;
      }
      resolve();
    });
  },

  handleSuccess(e) {
    const { files } = e.detail;
    this.setData({
      'sessionFrom.rightsImageUrls': files,
    });
  },

  handleRemove(e) {
    const { index } = e.detail;
    const {
      sessionFrom: { rightsImageUrls },
    } = this.data;
    rightsImageUrls.splice(index, 1);
    this.setData({
      'sessionFrom.rightsImageUrls': rightsImageUrls,
    });
  },

  handleComplete() {
    this.setData({
      uploading: false,
    });
  },

  handleSelectChange() {
    this.setData({
      uploading: true,
    });
  },
});
</script>

<template>
<view class="select-service [&_.service-form_.service-from-group]:[margin-top:20rpx] [&_.service-form]:[padding-bottom:calc(env(safe-area-inset-bottom)_+_80rpx)] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-size:36rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-size:28rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-size:24rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-family:DIN_Alternate] [&_.remark]:[min-height:110rpx] [&_.remark]:[border-radius:10rpx] [&_.remark]:[margin-top:20rpx] [&_.remark]:[background-color:#f5f5f5] [&_.special-cell_.special-cell-note]:[display:flex] [&_.special-cell_.special-cell-note]:[flex-direction:column] [&_.special-cell_.wr-cell__title]:[margin-right:100rpx] [&_.special-cell_.special-cell-note-price-class]:[font-size:36rpx] [&_.special-cell_.special-cell-note-price-class]:[color:#fa4126] [&_.special-cell_.special-cell-note-price-class]:[font-family:DIN_Alternate] [&_.special-cell_.special-cell-note-price-decimal]:[font-size:28rpx] [&_.special-cell_.special-cell-note-price-decimal]:[color:#fa4126] [&_.special-cell_.special-cell-note-price-decimal]:[font-family:DIN_Alternate] [&_.special-cell_.special-cell-note-price-symbol]:[color:#fa4126] [&_.special-cell_.special-cell-note-price-symbol]:[font-size:24rpx] [&_.special-cell_.special-cell-note-price-symbol]:[font-family:DIN_Alternate] [&_.bottom-bar__btn]:[width:686rpx] [&_.bottom-bar__btn]:[background-color:#fa4126] [&_.bottom-bar__btn]:[color:white] [&_.bottom-bar__btn]:[font-size:32rpx] [&_.bottom-bar__btn]:[border-radius:48rpx] [&_.bottom-bar__btn]:[position:absolute] [&_.bottom-bar__btn]:[left:50%] [&_.bottom-bar__btn]:[top:20rpx] [&_.bottom-bar__btn]:[transform:translateX(-50%)] [&_.bottom-bar__btn_.disabled]:[background-color:#c6c6c6] [&_.order-goods-card_.wr-goods-card]:[padding:0_30rpx] [&_.bottom-bar]:[background-color:#fff] [&_.bottom-bar]:[position:fixed] [&_.bottom-bar]:[bottom:0] [&_.bottom-bar]:[left:0] [&_.bottom-bar]:[width:100%] [&_.bottom-bar]:[height:158rpx] [&_.bottom-bar]:[z-index:3]">
  <view class="order-goods-card [background:#fff] [margin-bottom:24rpx]">
    <wr-order-goods-card goods="{{goodsInfo}}" no-top-line thumb-class="order-goods-card-title-class ![width:10rpx]">
      <view slot="footer" class="order-goods-card-footer [display:flex] [width:calc(100%_-_190rpx)] [justify-content:space-between] [position:absolute] [bottom:0] [left:190rpx] [bottom:20rpx]">
        <wr-price
          price="{{goodsInfo.paidAmountEach}}"
          fill
          wr-class="order-goods-card-footer-price-class"
          symbol-class="order-goods-card-footer-price-symbol"
          decimal-class="order-goods-card-footer-price-decimal"
        />
        <view class="order-goods-card-footer-num [color:#999] [line-height:40rpx]">x {{goodsInfo.boughtQuantity}}</view>
      </view>
    </wr-order-goods-card>
  </view>
  <view wx:if="{{!serviceRequireType}}" class="service-choice [&_.t-cell__title-text]:[color:#333] [&_.t-cell__title-text]:[font-weight:bold]">
    <t-cell-group>
      <t-cell
        title="申请退款（无需退货）"
        arrow
        description="没收到货，或与商家协商同意不用退货只退款"
        bindtap="onApplyOnlyRefund"
      >
        <t-icon
          slot="left-icon"
          prefix="wr"
          class="t-cell__left__icon [position:relative] [top:-24rpx] [margin-right:18rpx]"
          name="goods_refund"
          size="48rpx"
          color="#fa4126"
        />
      </t-cell>
      <t-cell
        wx:if="{{canApplyReturn}}"
        title="退货退款"
        description="已收到货，需要退还收到的商品"
        arrow
        bindtap="onApplyReturnGoods"
      >
        <t-icon
          slot="left-icon"
          prefix="wr"
          class="t-cell__left__icon [position:relative] [top:-24rpx] [margin-right:18rpx]"
          name="goods_return"
          size="48rpx"
          color="#fa4126"
        />
      </t-cell>
      <t-cell wx:else class="non-returnable" title="退货退款" description="该商品不支持退货">
        <t-icon
          slot="left-icon"
          prefix="wr"
          class="t-cell__left__icon [position:relative] [top:-24rpx] [margin-right:18rpx]"
          name="goods_return"
          size="48rpx"
          color="#fa4126"
        />
      </t-cell>
    </t-cell-group>
  </view>
  <!-- 售后表单 -->
  <view wx:else class="service-form [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-class]:[font-size:36rpx] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-class]:[font-family:DIN_Alternate] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-decimal]:[font-size:28rpx] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-decimal]:[font-family:DIN_Alternate] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-symbol]:[font-size:24rpx] [&_.service-from-group_.service-from-group__wrapper_.refund-money-price-symbol]:[font-family:DIN_Alternate]">
    <view class="service-from-group">
      <t-cell-group>
        <t-cell title="商品收货状态" arrow note="{{serviceFrom.receiptStatus.desc}}" bind:tap="onApplyGoodsStatus" />
        <t-cell
          bordered="{{false}}"
          title="退款原因"
          wx:if="{{canApplyReturn}}"
          note="{{serviceFrom.applyReason.desc}}"
          arrow
          bindtap="onApplyReturnGoodsStatus"
        />
      </t-cell-group>
    </view>
    <view class="service-from-group">
      <t-cell-group>
        <t-cell title="退款商品数量">
          <t-stepper
            slot="note"
            theme="filled"
            min="1"
            max="{{maxApplyNum}}"
            value="{{serviceFrom.returnNum}}"
            bindchange="onChangeReturnNum"
          />
        </t-cell>
        <t-cell
          title="退款金额"
          t-class-description="refund-money__description"
          description="{{amountTip}}"
          bind:tap="onAmountTap"
        >
          <view class="service-from-group__wrapper [display:flex] [flex-direction:column] [font-family:DIN_Alternate] [font-weight:bold] [font-size:36rpx] [text-align:right] [color:#fa4126]" slot="note">
            <wr-price
              price="{{serviceFrom.amount.current}}"
              fill
              wr-class="refund-money-price-class"
              symbol-class="refund-money-price-symbol"
              decimal-class="refund-money-price-decimal"
            />
            <view class="service-from-group__price [display:flex] [align-items:center] [color:#bbb] [font-size:24rpx] [position:relative] [left:30rpx]">
              修改
              <t-icon color="#bbb" name="chevron-right" size="30rpx" slot="left-icon" />
            </view>
          </view>
        </t-cell>
      </t-cell-group>
    </view>
    <view class="service-from-group__textarea [margin-top:20rpx] [background-color:#fff] [padding:32rpx_32rpx_24rpx] [&_.t-textarea__wrapper_.t-textarea__wrapper-textarea]:[height:136rpx] [&_.t-textarea__wrapper_.t-textarea__wrapper-textarea]:[box-sizing:border-box]">
      <text class="textarea--label">退款说明</text>
      <t-textarea
        style="height: 220rpx"
        value="{{serviceFrom.remark}}"
        t-class="textarea--content [margin-top:32rpx] ![background:#f5f5f5] [border-radius:16rpx]"
        maxlength="200"
        indicator
        placeholder="退款说明（选填）"
        bind:change="onRemarkChange"
      />
    </view>
    <view class="service-from-group__grid [padding:0_32rpx_48rpx] [background:#fff] [margin-bottom:148rpx]">
      <t-upload
        media-type="{{['image','video']}}"
        files="{{sessionFrom.rightsImageUrls}}"
        bind:remove="handleRemove"
        bind:success="handleSuccess"
        bind:complete="handleComplete"
        bind:select-change="handleSelectChange"
        gridConfig="{{uploadGridConfig}}"
        max="3"
      >
        <view slot="add-content" class="upload-addcontent-slot [background-color:#f5f5f5] [height:inherit] [display:flex] [flex-direction:column] [align-items:center] [justify-content:center]">
          <t-icon name="add" size="60rpx" />
          <view class="upload-desc [text-align:center] [display:flex] [flex-direction:column] [font-size:24rpx] [color:#999]">
            <text>上传凭证</text>
            <text>（最多3张）</text>
          </view>
        </view>
      </t-upload>
    </view>
    <view class="bottom-bar">
      <t-button
        t-class="bottom-bar__btn {{validateRes.valid && !uploading ? '' : 'disabled'}}"
        bindtap="onSubmit"
        loading="{{submitting}}"
      >
        提交
      </t-button>
    </view>
  </view>
</view>
<!-- 收货状态选择 -->
<t-popup visible="{{showReceiptStatusDialog}}" placement="bottom" bindclose="onReceiptStatusDialogConfirm">
  <view class="dialog--service-status [background-color:#f3f4f5] [overflow:hidden] [&_.options_.option]:[color:#333333] [&_.options_.option]:[font-size:30rpx] [&_.options_.option]:[text-align:center] [&_.options_.option]:[height:100rpx] [&_.options_.option]:[line-height:100rpx] [&_.options_.option]:[background-color:white] [&_.options_.option--active]:[opacity:0.5] [&_.options_.option_.main]:[color:#fa4126] [&_.cancel]:[color:#333333] [&_.cancel]:[font-size:30rpx] [&_.cancel]:[text-align:center] [&_.cancel]:[height:100rpx] [&_.cancel]:[line-height:100rpx] [&_.cancel]:[background-color:white] [&_.cancel]:[margin-top:20rpx] [&_.cancel--active]:[opacity:0.5]" slot="content">
    <view class="options">
      <view
        wx:for="{{receiptStatusList}}"
        wx:key="status"
        class="option"
        hover-class="option--active"
        bindtap="onReceiptStatusDialogConfirm"
        data-index="{{index}}"
      >
        {{item.desc}}
      </view>
    </view>
    <view class="cancel" hover-class="cancel--active" bindtap="onReceiptStatusDialogConfirm">取消</view>
  </view>
</t-popup>
<!-- 理由选择 -->
<wr-reason-sheet id="wr-reason-sheet" />
<!-- 金额填写 -->
<t-dialog
  id="input-dialog"
  visible="{{inputDialogVisible}}"
  class="{{serviceFrom.amount.focus ? 'amount-dialog--focus' : ''}} [&_.popup__content--center]:[top:100rpx] [&_.popup__content--center]:[transform:translate(-50%,_0)]"
>
  <view class="input-dialog__title [color:#333] [font-size:32rpx] [font-weight:normal]" slot="title">退款金额</view>
  <view class="input-dialog__content [&_.input-dialog__input]:[font-size:72rpx] [&_.input-dialog__input]:[height:64rpx] [&_.input-dialog__input]:[line-height:64rpx] [&_.input]:[font-size:48rpx] [&_.input]:[padding-left:0] [&_.input]:[padding-right:0] [&_.tips]:[margin-top:24rpx] [&_.tips]:[font-size:24rpx] [&_.tips]:[color:#999999]" slot="content">
    <t-input
      t-class="input"
      t-class-input="input-dialog__input"
      t-class-label="input-dialog__label"
      placeholder=""
      value="{{serviceFrom.amount.temp}}"
      type="digit"
      focus="{{serviceFrom.amount.focus}}"
      bindinput="onAmountInput"
      bindfocus="onAmountFocus"
      bindblur="onAmountBlur"
      label="¥"
    ></t-input>
    <view class="tips">{{amountTip}}</view>
  </view>
</t-dialog>
<t-dialog id="t-dialog" />
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "选择售后类型",
  "usingComponents": {
    "wr-price": "/components/price/index",
    "wr-order-goods-card": "../components/order-goods-card/index",
    "wr-reason-sheet": "../components/reason-sheet/index",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-button": "tdesign-miniprogram/button/button",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group",
    "t-stepper": "tdesign-miniprogram/stepper/stepper",
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-textarea": "tdesign-miniprogram/textarea/textarea",
    "t-input": "tdesign-miniprogram/input/input",
    "t-upload": "tdesign-miniprogram/upload/upload"
  }
}</json>
