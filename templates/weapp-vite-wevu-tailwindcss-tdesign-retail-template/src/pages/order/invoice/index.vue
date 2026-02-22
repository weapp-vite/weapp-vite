<script setup lang="ts">
import { onLoad, ref } from 'wevu';
import { fetchOrderDetail } from '../../../services/order/orderDetail';

const orderNo = ref('');
const invoice = ref<Record<string, unknown>>({});

function init() {
  void getDetail();
}

function getDetail() {
  const params = {
    parameter: orderNo.value,
  };
  return fetchOrderDetail(params).then((res: any) => {
    const order = res.data;
    invoice.value = {
      buyerName: order?.invoiceVO?.buyerName,
      // 个人或公司名称
      buyerTaxNo: order?.invoiceVO?.buyerTaxNo,
      // 税号
      buyerPhone: order?.invoiceVO?.buyerPhone,
      // 手机
      email: order?.invoiceVO?.email,
      // 邮箱
      titleType: order?.invoiceVO?.titleType === 1 ? '个人' : '公司',
      // 发票抬头 1-个人 2-公司
      ontentType: order?.invoiceVO?.ontentType === 1 ? '商品明细' : '2类别',
      // 发票内容 1-明细 2类别
      invoiceType: order?.invoiceVO?.invoiceType === 5 ? '电子普通发票' : '不开发票',
      // 是否开票 0-不开 5-电子发票
      isInvoice: order?.invoiceVO?.buyerName ? '已开票' : '未开票',
      money: order?.invoiceVO?.money,
    };
  });
}

onLoad((query: { orderNo?: string }) => {
  orderNo.value = query.orderNo || '';
  init();
});

defineExpose({
  invoice,
});
</script>

<template>
<view class="invoice-detail [&_.invoice-detail-box]:[background-color:#fff] [&_.invoice-detail-box]:[padding:24rpx_32rpx] [&_.invoice-detail-box]:[margin-top:24rpx]">
  <view class="invoice-detail-box">
    <view class="invoice-detail-title [font-size:14px] [font-weight:600]">发票详情</view>
    <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">发票类型</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.invoiceType}}</view>
    </view>
    <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">发票抬头</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.buyerName}}</view>
    </view>
    <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">纳税人识别号</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.buyerTaxNo}}</view>
    </view>
    <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">发票内容</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.ontentType}}</view>
    </view>
     <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">发票金额</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.money}}</view>
    </view>
  </view>
  <view class="invoice-detail-box">
    <view class="invoice-detail-title [font-size:14px] [font-weight:600]">收票人信息</view>
    <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">邮箱</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.email}}</view>
    </view>
    <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">手机号</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.buyerPhone}}</view>
    </view>
    <view class="invoice-detail-box-row [display:flex] [margin-top:44rpx]">
      <view class="invoice-detail-box-title [font-size:13px] [color:#666666] [width:156rpx] [margin-right:32rpx]">开票状态</view>
      <view class="invoice-detail-box-value [font-size:13px] [color:#333333]">{{invoice.isInvoice}}</view>
    </view>
  </view>
</view>
</template>

<json>
{
  "navigationBarTitleText": "发票详情",
  "usingComponents": {
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-button": "tdesign-miniprogram/button/button",
    "t-cell-group": "tdesign-miniprogram/cell-group/cell-group"
  }
}
</json>
