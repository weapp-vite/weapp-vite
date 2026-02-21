<script setup lang="ts">
import { formatTime } from '../../../utils/util';
import { OrderStatus, LogisticsIconMap } from '../config';
import { fetchBusinessTime, fetchOrderDetail } from '../../../services/order/orderDetail';
import Toast from 'tdesign-miniprogram/toast/index';
import { getAddressPromise } from '../../../services/address/list';
defineOptions({
  data() {
    return {
      pageLoading: true,
      order: {},
      // 后台返回的原始数据
      _order: {},
      // 内部使用和提供给 order-card 的数据
      storeDetail: {},
      countDownTime: null,
      addressEditable: false,
      backRefresh: false,
      // 用于接收其他页面back时的状态
      formatCreateTime: '',
      //格式化订单创建时间
      logisticsNodes: [],
      /** 订单评论状态 */
      orderHasCommented: true
    };
  },
  onLoad(query) {
    this.orderNo = query.orderNo;
    this.init();
    this.navbar = this.selectComponent('#navbar');
    this.pullDownRefresh = this.selectComponent('#wr-pull-down-refresh');
  },
  onShow() {
    // 当从其他页面返回，并且 backRefresh 被置为 true 时，刷新数据
    if (!this.data.backRefresh) return;
    this.onRefresh();
    this.setData({
      backRefresh: false
    });
  },
  onPageScroll(e) {
    this.pullDownRefresh && this.pullDownRefresh.onPageScroll(e);
  },
  onImgError(e) {
    if (e.detail) {
      console.error('img 加载失败');
    }
  },
  // 页面初始化，会展示pageLoading
  init() {
    this.setData({
      pageLoading: true
    });
    this.getStoreDetail();
    this.getDetail().then(() => {
      this.setData({
        pageLoading: false
      });
    }).catch(e => {
      console.error(e);
    });
  },
  // 页面刷新，展示下拉刷新
  onRefresh() {
    this.init();
    // 如果上一页为订单列表，通知其刷新数据
    const pages = getCurrentPages();
    const lastPage = pages[pages.length - 2];
    if (lastPage) {
      lastPage.data.backRefresh = true;
    }
  },
  // 页面刷新，展示下拉刷新
  onPullDownRefresh_(e) {
    const {
      callback
    } = e.detail;
    return this.getDetail().then(() => callback && callback());
  },
  getDetail() {
    const params = {
      parameter: this.orderNo
    };
    return fetchOrderDetail(params).then(res => {
      const order = res.data;
      const _order = {
        id: order.orderId,
        orderNo: order.orderNo,
        parentOrderNo: order.parentOrderNo,
        storeId: order.storeId,
        storeName: order.storeName,
        status: order.orderStatus,
        statusDesc: order.orderStatusName,
        amount: order.paymentAmount,
        totalAmount: order.goodsAmountApp,
        logisticsNo: order.logisticsVO.logisticsNo,
        goodsList: (order.orderItemVOs || []).map(goods => Object.assign({}, goods, {
          id: goods.id,
          thumb: goods.goodsPictureUrl,
          title: goods.goodsName,
          skuId: goods.skuId,
          spuId: goods.spuId,
          specs: (goods.specifications || []).map(s => s.specValue),
          price: goods.tagPrice ? goods.tagPrice : goods.actualPrice,
          // 商品销售单价, 优先取限时活动价
          num: goods.buyQuantity,
          titlePrefixTags: goods.tagText ? [{
            text: goods.tagText
          }] : [],
          buttons: goods.buttonVOs || []
        })),
        buttons: order.buttonVOs || [],
        createTime: order.createTime,
        receiverAddress: this.composeAddress(order),
        groupInfoVo: order.groupInfoVo
      };
      this.setData({
        order,
        _order,
        formatCreateTime: formatTime(parseFloat(`${order.createTime}`), 'YYYY-MM-DD HH:mm'),
        // 格式化订单创建时间
        countDownTime: this.computeCountDownTime(order),
        addressEditable: [OrderStatus.PENDING_PAYMENT, OrderStatus.PENDING_DELIVERY].includes(order.orderStatus) && order.orderSubStatus !== -1,
        // 订单正在取消审核时不允许修改地址（但是返回的状态码与待发货一致）
        isPaid: !!order.paymentVO.paySuccessTime,
        invoiceStatus: this.datermineInvoiceStatus(order),
        invoiceDesc: order.invoiceDesc,
        invoiceType: order.invoiceVO?.invoiceType === 5 ? '电子普通发票' : '不开发票',
        //是否开票 0-不开 5-电子发票
        logisticsNodes: this.flattenNodes(order.trajectoryVos || [])
      });
    });
  },
  // 展开物流节点
  flattenNodes(nodes) {
    return (nodes || []).reduce((res, node) => {
      return (node.nodes || []).reduce((res1, subNode, index) => {
        res1.push({
          title: index === 0 ? node.title : '',
          // 子节点中仅第一个显示title
          desc: subNode.status,
          date: formatTime(+subNode.timestamp, 'YYYY-MM-DD HH:mm:ss'),
          icon: index === 0 ? LogisticsIconMap[node.code] || '' : '' // 子节点中仅第一个显示icon
        });
        return res1;
      }, res);
    }, []);
  },
  datermineInvoiceStatus(order) {
    // 1-已开票
    // 2-未开票（可补开）
    // 3-未开票
    // 4-门店不支持开票
    return order.invoiceStatus;
  },
  // 拼接省市区
  composeAddress(order) {
    return [
    //order.logisticsVO.receiverProvince,
    order.logisticsVO.receiverCity, order.logisticsVO.receiverCountry, order.logisticsVO.receiverArea, order.logisticsVO.receiverAddress].filter(s => !!s).join(' ');
  },
  getStoreDetail() {
    fetchBusinessTime().then(res => {
      const storeDetail = {
        storeTel: res.data.telphone,
        storeBusiness: res.data.businessTime.join('\n')
      };
      this.setData({
        storeDetail
      });
    });
  },
  // 仅对待支付状态计算付款倒计时
  // 返回时间若是大于2020.01.01，说明返回的是关闭时间，否则说明返回的直接就是剩余时间
  computeCountDownTime(order) {
    if (order.orderStatus !== OrderStatus.PENDING_PAYMENT) return null;
    return order.autoCancelTime > 1577808000000 ? order.autoCancelTime - Date.now() : order.autoCancelTime;
  },
  onCountDownFinish() {
    //this.setData({ countDownTime: -1 });
    const {
      countDownTime,
      order
    } = this.data;
    if (countDownTime > 0 || order && order.groupInfoVo && order.groupInfoVo.residueTime > 0) {
      this.onRefresh();
    }
  },
  onGoodsCardTap(e) {
    const {
      index
    } = e.currentTarget.dataset;
    const goods = this.data.order.orderItemVOs[index];
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${goods.spuId}`
    });
  },
  onEditAddressTap() {
    getAddressPromise().then(address => {
      this.setData({
        'order.logisticsVO.receiverName': address.name,
        'order.logisticsVO.receiverPhone': address.phone,
        '_order.receiverAddress': address.address
      });
    }).catch(() => {});
    wx.navigateTo({
      url: `/pages/user/address/list/index?selectMode=1`
    });
  },
  onOrderNumCopy() {
    wx.setClipboardData({
      data: this.data.order.orderNo
    });
  },
  onDeliveryNumCopy() {
    wx.setClipboardData({
      data: this.data.order.logisticsVO.logisticsNo
    });
  },
  onToInvoice() {
    wx.navigateTo({
      url: `/pages/order/invoice/index?orderNo=${this.data._order.orderNo}`
    });
  },
  onSuppleMentInvoice() {
    wx.navigateTo({
      url: `/pages/order/receipt/index?orderNo=${this.data._order.orderNo}`
    });
  },
  onDeliveryClick() {
    const logisticsData = {
      nodes: this.data.logisticsNodes,
      company: this.data.order.logisticsVO.logisticsCompanyName,
      logisticsNo: this.data.order.logisticsVO.logisticsNo,
      phoneNumber: this.data.order.logisticsVO.logisticsCompanyTel
    };
    wx.navigateTo({
      url: `/pages/order/delivery-detail/index?data=${encodeURIComponent(JSON.stringify(logisticsData))}`
    });
  },
  /** 跳转订单评价 */
  navToCommentCreate() {
    wx.navigateTo({
      url: `/pages/order/createComment/index?orderNo=${this.orderNo}`
    });
  },
  /** 跳转拼团详情/分享页*/
  toGrouponDetail() {
    wx.showToast({
      title: '点击了拼团'
    });
  },
  clickService() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '您点击了联系客服'
    });
  },
  onOrderInvoiceView() {
    wx.navigateTo({
      url: `/pages/order/invoice/index?orderNo=${this.orderNo}`
    });
  }
});
</script>

<template>
<t-pull-down-refresh id="t-pull-down-refresh" bindrefresh="onPullDownRefresh_" t-class-indicator="t-class-indicator">
  <!-- 页面内容 -->
  <view class="order-detail [width:100%] [box-sizing:border-box] [padding:0rpx_0rpx_calc(env(safe-area-inset-bottom)_+_144rpx)] [&_.count-down]:[color:#ffffff] [&_.header]:[width:100%] [&_.header]:[background-color:#ffffff] [&_.order-detail__header]:[width:700rpx] [&_.order-detail__header]:[height:200rpx] [&_.order-detail__header]:[border-radius:24rpx] [&_.order-detail__header]:[margin:0_auto] [&_.order-detail__header]:[overflow:hidden] [&_.order-detail__header]:[display:flex] [&_.order-detail__header]:[flex-direction:column] [&_.order-detail__header]:[align-items:center] [&_.order-detail__header]:[justify-content:center] [&_.order-detail__header]:[background-image:url('https://tdesign.gtimg.com/miniprogram/template/retail/template/order-bg.png')] [&_.order-detail__header]:[background-repeat:no-repeat] [&_.order-detail__header]:[background-size:contain] [&_.order-detail__header_.title]:[color:#ffffff] [&_.order-detail__header_.title]:[overflow:hidden] [&_.order-detail__header_.title]:[display:-webkit-box] [&_.order-detail__header_.title]:[-webkit-box-orient:vertical] [&_.order-detail__header_.desc]:[color:#ffffff] [&_.order-detail__header_.desc]:[overflow:hidden] [&_.order-detail__header_.desc]:[display:-webkit-box] [&_.order-detail__header_.desc]:[-webkit-box-orient:vertical] [&_.order-detail__header_.title]:[-webkit-line-clamp:1] [&_.order-detail__header_.title]:[font-size:44rpx] [&_.order-detail__header_.title]:[line-height:64rpx] [&_.order-detail__header_.title]:[margin-bottom:8rpx] [&_.order-detail__header_.title]:[font-weight:bold] [&_.order-detail__header_.desc]:[-webkit-line-clamp:2] [&_.order-detail__header_.desc]:[font-size:24rpx] [&_.order-detail__header_.desc]:[line-height:32rpx] [&_.order-detail__header_.desc_.count-down]:[display:inline] [&_.order-logistics]:[box-sizing:border-box] [&_.order-logistics]:[padding:32rpx] [&_.order-logistics]:[width:100%] [&_.order-logistics]:[background-color:#ffffff] [&_.order-logistics]:[overflow:hidden] [&_.order-logistics]:[color:#333333] [&_.order-logistics]:[font-size:32rpx] [&_.order-logistics]:[line-height:48rpx] [&_.order-logistics]:[display:flex] [&_.order-logistics]:[position:relative] [&_.border-bottom]:[margin:0_auto] [&_.border-bottom]:[width:686rpx] [&_.border-bottom]:[scale:1_0.5] [&_.border-bottom]:[height:2rpx] [&_.border-bottom]:[background-color:#e5e5e5] [&_.border-bottom-margin]:[margin:16rpx_auto] [&_.pay-detail]:[background-color:#ffffff] [&_.pay-detail]:[width:100%] [&_.pay-detail]:[box-sizing:border-box] [&_.padding-inline]:[padding:16rpx_32rpx] [&_.pay-detail_.pay-item]:[width:100%] [&_.pay-detail_.pay-item]:[height:72rpx] [&_.pay-detail_.pay-item]:[display:flex] [&_.pay-detail_.pay-item]:[align-items:center] [&_.pay-detail_.pay-item]:[justify-content:space-between] [&_.pay-detail_.pay-item]:[font-size:26rpx] [&_.pay-detail_.pay-item]:[line-height:36rpx] [&_.pay-detail_.pay-item]:[color:#666666] [&_.pay-detail_.pay-item]:[background-color:#ffffff] [&_.pay-detail_.pay-item_.pay-item__right]:[color:#333333] [&_.pay-detail_.pay-item_.pay-item__right]:[font-size:24rpx] [&_.pay-detail_.pay-item_.pay-item__right]:[display:flex] [&_.pay-detail_.pay-item_.pay-item__right]:[align-items:center] [&_.pay-detail_.pay-item_.pay-item__right]:[justify-content:flex-end] [&_.pay-detail_.pay-item_.pay-item__right]:[max-width:400rpx] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[display:-webkit-box] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[-webkit-box-orient:vertical] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[-webkit-line-clamp:2] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[max-width:400rpx] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[text-overflow:ellipsis] [&_.pay-detail_.pay-item_.pay-item__right_.pay-remark]:[overflow:hidden] [&_.pay-detail_.pay-item_.font-bold]:[font-weight:bold] [&_.pay-detail_.pay-item_.primary]:[color:#fa4126] [&_.pay-detail_.pay-item_.max-size]:[font-size:36rpx] [&_.pay-detail_.pay-item_.max-size]:[line-height:48rpx] [&_.pay-detail_.pay-service]:[width:100%] [&_.pay-detail_.pay-service]:[height:72rpx] [&_.pay-detail_.pay-service]:[display:flex] [&_.pay-detail_.pay-service]:[align-items:center] [&_.pay-detail_.pay-service]:[justify-content:center] [&_.pay-detail_.pay-service]:[font-size:32rpx] [&_.pay-detail_.pay-service]:[line-height:36rpx] [&_.pay-detail_.pay-service]:[color:#333333] [&_.pay-detail_.pay-service]:[background-color:#ffffff]">
    <view class="header">
      <view class="order-detail__header">
        <view class="title">{{_order.statusDesc}}</view>
        <view class="desc">
          <block wx:if="{{ order.holdStatus === 1 }}">
            <block wx:if="{{ order.groupInfoVo.residueTime > 0 }}">
              拼团剩余
              <t-count-down
                time="{{order.groupInfoVo.residueTime}}"
                format="HH小时mm分ss秒"
                t-class="count-down"
                bindfinish="onCountDownFinish"
              />
              <view>过时自动取消</view>
            </block>
          </block>
          <block wx:elif="{{countDownTime === null}}">{{order.orderStatusRemark || ''}}</block>
          <block wx:elif="{{countDownTime > 0}}">
            剩
            <t-count-down
              time="{{countDownTime}}"
              format="HH小时mm分ss秒"
              t-class="count-down"
              bindfinish="onCountDownFinish"
            />
            支付，过时订单将会取消
          </block>
          <block wx:else>超时未支付</block>
        </view>
      </view>

      <!-- 物流 -->
      <view class="order-logistics [&_.logistics-icon]:[width:40rpx] [&_.logistics-icon]:[height:40rpx] [&_.logistics-icon]:[margin-right:16rpx] [&_.logistics-icon]:[margin-top:4rpx] [&_.logistics-content]:[flex:1] [&_.logistics-content_.logistics-time]:[font-size:28rpx] [&_.logistics-content_.logistics-time]:[line-height:40rpx] [&_.logistics-content_.logistics-time]:[color:#999999] [&_.logistics-content_.logistics-time]:[margin-top:12rpx] [&_.logistics-back]:[color:#999999] [&_.logistics-back]:[align-self:center] [&_.edit-text]:[color:#fa4126] [&_.edit-text]:[font-size:26rpx] [&_.edit-text]:[line-height:36rpx]" wx:if="{{logisticsNodes[0]}}" bindtap="onDeliveryClick">
        <t-icon name="deliver" size="40rpx" class="logistics-icon" prefix="wr" />
        <view class="logistics-content">
          <view>{{logisticsNodes[0].desc}}</view>
          <view class="logistics-time">{{logisticsNodes[0].date}}</view>
        </view>
        <t-icon class="logistics-back" name="arrow_forward" size="36rpx" prefix="wr" />
      </view>
      <view class="border-bottom" wx:if="{{logisticsNodes[0]}}" />
      <!-- 收货地址 -->
      <view class="order-logistics [&_.logistics-icon]:[width:40rpx] [&_.logistics-icon]:[height:40rpx] [&_.logistics-icon]:[margin-right:16rpx] [&_.logistics-icon]:[margin-top:4rpx] [&_.logistics-content]:[flex:1] [&_.logistics-content_.logistics-time]:[font-size:28rpx] [&_.logistics-content_.logistics-time]:[line-height:40rpx] [&_.logistics-content_.logistics-time]:[color:#999999] [&_.logistics-content_.logistics-time]:[margin-top:12rpx] [&_.logistics-back]:[color:#999999] [&_.logistics-back]:[align-self:center] [&_.edit-text]:[color:#fa4126] [&_.edit-text]:[font-size:26rpx] [&_.edit-text]:[line-height:36rpx]">
        <t-icon name="location" size="40rpx" class="logistics-icon" prefix="wr" />
        <view class="logistics-content">
          <view>{{order.logisticsVO.receiverName + ' '}}{{order.logisticsVO.receiverPhone}}</view>
          <view class="logistics-time">{{_order.receiverAddress}}</view>
        </view>
        <view wx:if="{{addressEditable}}" class="edit-text" bindtap="onEditAddressTap"> 修改 </view>
      </view>
    </view>
    <!-- 店铺及商品 -->
    <order-card order="{{_order}}" use-top-right-slot>
      <order-goods-card
        wx:for="{{_order.goodsList}}"
        wx:key="id"
        wx:for-item="goods"
        wx:for-index="gIndex"
        goods="{{goods}}"
        no-top-line="{{gIndex === 0}}"
        bindtap="onGoodsCardTap"
        data-index="{{gIndex}}"
      >
        <order-button-bar
          slot="append-card"
          class="goods-button-bar [height:112rpx] [width:686rpx] [margin-bottom:16rpx]"
          order="{{_order}}"
          bindrefresh="onRefresh"
          goodsIndex="{{gIndex}}"
        />
      </order-goods-card>
      <view class="pay-detail">
        <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
          <text>商品总额</text>
          <price fill decimalSmaller wr-class="pay-item__right font-bold" price="{{order.totalAmount || '0'}}" />
        </view>
        <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
          <text>运费</text>
          <view class="pay-item__right font-bold">
            <block wx:if="{{order.freightFee}}">
              +
              <price fill decimalSmaller price="{{order.freightFee}}" />
            </block>
            <text wx:else>免运费</text>
          </view>
        </view>
        <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
          <text>活动优惠</text>
          <view class="pay-item__right primary font-bold">
            -
            <price fill price="{{order.discountAmount || 0}}" />
          </view>
        </view>
        <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
          <text>优惠券</text>
          <view class="pay-item__right" catchtap="onOpenCoupons">
            <block wx:if="{{order.couponAmount}}">
              -
              <price fill decimalSmaller price="{{order.couponAmount}}" />
            </block>
            <text wx:else>无可用</text>
            <!-- <t-icon name="chevron-right" size="32rpx" color="#BBBBBB" /> -->
          </view>
        </view>
        <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
          <text>{{isPaid ? '实付' : '应付'}}</text>
          <price
            fill
            decimalSmaller
            wr-class="pay-item__right font-bold primary max-size"
            price="{{order.paymentAmount || '0'}}"
          />
        </view>
      </view>
    </order-card>
    <view class="pay-detail padding-inline">
      <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
        <text>订单编号</text>
        <view class="pay-item__right" bindtap="onOrderNumCopy">
          <text class="order-no">{{order.orderNo}}</text>
          <view class="pay-item__right__copy">复制</view>
        </view>
      </view>
      <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
        <text>下单时间</text>
        <view class="pay-item__right">
          <text class="order-no normal-color">{{formatCreateTime}}</text>
        </view>
      </view>
      <view class="border-bottom border-bottom-margin" />
      <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
        <text>发票</text>
        <view class="pay-item__right" bindtap="onOrderInvoiceView">
          <text class="order-no normal-color">{{invoiceType}}</text>
          <view class="pay-item__right__copy">查看</view>
        </view>
      </view>
      <view class="pay-item [&_.pay-item__right_.pay-item__right__copy]:[width:80rpx] [&_.pay-item__right_.pay-item__right__copy]:[height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[text-align:center] [&_.pay-item__right_.pay-item__right__copy]:[font-size:24rpx] [&_.pay-item__right_.pay-item__right__copy]:[line-height:40rpx] [&_.pay-item__right_.pay-item__right__copy]:[color:#333333] [&_.pay-item__right_.pay-item__right__copy]:[position:relative] [&_.pay-item__right_.order-no]:[color:#333333] [&_.pay-item__right_.order-no]:[font-size:26rpx] [&_.pay-item__right_.order-no]:[line-height:40rpx] [&_.pay-item__right_.order-no]:[padding-right:16rpx] [&_.pay-item__right_.normal-color]:[color:#333333]">
        <text>备注</text>
        <view class="pay-item__right">
          <text class="order-no normal-color">{{order.remark || '-'}}</text>
        </view>
      </view>
      <view class="border-bottom border-bottom-margin" />
      <view class="pay-service" wx:if="{{storeDetail && storeDetail.storeTel}}" catch:tap="clickService">
        <t-icon name="service" size="40rpx" />
        <text decode="{{true}}">&nbsp;联系客服</text>
      </view>
    </view>
  </view>
  <view wx:if="{{_order.buttons.length > 0}}" class="bottom-bar [position:fixed] [left:0] [bottom:0] [right:0] [z-index:10] [background:#fff] [height:112rpx] [width:686rpx] [padding:0rpx_32rpx_env(safe-area-inset-bottom)] [display:flex] [align-items:center]">
    <order-button-bar order="{{_order}}" bindrefresh="onRefresh" isBtnMax />
  </view>
</t-pull-down-refresh>
<t-toast id="t-toast" />
<t-dialog id="t-dialog" />
</template>

<json>
{
  "navigationBarTitleText": "订单详情",
  "usingComponents": {
    "t-pull-down-refresh": "tdesign-miniprogram/pull-down-refresh/pull-down-refresh",
    "t-button": "tdesign-miniprogram/button/button",
    "t-cell": "tdesign-miniprogram/cell/cell",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-image": "/components/webp-image/index",
    "t-count-down": "tdesign-miniprogram/count-down/count-down",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "price": "/components/price/index",
    "order-card": "../components/order-card/index",
    "order-goods-card": "../components/order-goods-card/index",
    "order-button-bar": "../components/order-button-bar/index"
  }
}</json>
