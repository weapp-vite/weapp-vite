<script lang="ts">
import { getRightsList } from './api';
import { AfterServiceStatus, ServiceType, ServiceTypeDesc } from '../config';

Page({
  page: {
    size: 10,
    num: 1,
  },

  data: {
    tabs: [
      {
        key: -1,
        text: '全部',
      },
      {
        key: AfterServiceStatus.TO_AUDIT,
        text: '待审核',
      },
      {
        key: AfterServiceStatus.THE_APPROVED,
        text: '已审核',
      },
      {
        key: AfterServiceStatus.COMPLETE,
        text: '已完成',
      },
      {
        key: AfterServiceStatus.CLOSED,
        text: '已关闭',
      },
    ],
    curTab: -1,
    dataList: [],
    listLoading: 0, // 0-未加载，1-加载中，2-已全部加载
    pullDownRefreshing: false, // 下拉刷新时不显示load-more
    emptyImg: 'https://tdesign.gtimg.com/miniprogram/template/retail/order/empty-order-list.png',
    backRefresh: false,
  },

  onLoad(query) {
    let status = parseInt(query.status);
    status = this.data.tabs.map((t) => t.key).includes(status) ? status : -1;
    this.init(status);
    this.pullDownRefresh = this.selectComponent('#wr-pull-down-refresh');
  },

  onShow() {
    // 当从其他页面返回，并且 backRefresh 被置为 true 时，刷新数据
    if (!this.data.backRefresh) return;
    this.onRefresh();
    this.setData({
      backRefresh: false,
    });
  },

  onReachBottom() {
    if (this.data.listLoading === 0) {
      this.getAfterServiceList(this.data.curTab);
    }
  },

  onPageScroll(e) {
    this.pullDownRefresh && this.pullDownRefresh.onPageScroll(e);
  },

  onPullDownRefresh_(e) {
    const { callback } = e.detail;
    this.setData({
      pullDownRefreshing: true,
    }); // 下拉刷新时不显示load-more
    this.refreshList(this.data.curTab)
      .then(() => {
        this.setData({
          pullDownRefreshing: false,
        });
        callback && callback();
      })
      .catch((err) => {
        this.setData({
          pullDownRefreshing: false,
        });
        Promise.reject(err);
      });
  },

  init(status) {
    status = status !== undefined ? status : this.data.curTab;
    this.refreshList(status);
  },

  getAfterServiceList(statusCode = -1, reset = false) {
    const params = {
      parameter: {
        pageSize: this.page.size,
        pageNum: this.page.num,
      },
    };
    if (statusCode !== -1) params.parameter.afterServiceStatus = statusCode;
    this.setData({
      listLoading: 1,
    });
    return getRightsList(params)
      .then((res) => {
        this.page.num++;
        let dataList = [];
        let { tabs } = this.data;
        if (res && res.data && res.data.states) {
          tabs = this.data.tabs.map((item) => {
            switch (item.key) {
              case AfterServiceStatus.TO_AUDIT:
                item.info = res.data.states.audit;
                break;
              case AfterServiceStatus.THE_APPROVED:
                item.info = res.data.states.approved;
                break;
              case AfterServiceStatus.COMPLETE:
                item.info = res.data.states.complete;
                break;
              case AfterServiceStatus.CLOSED:
                item.info = res.data.states.closed;
                break;
            }
            return item;
          });
        }
        if (res && res.data && res.data.dataList) {
          dataList = (res.data.dataList || []).map((_data) => {
            return {
              id: _data.rights.rightsNo,
              serviceNo: _data.rights.rightsNo,
              storeName: _data.rights.storeName,
              type: _data.rights.rightsType,
              typeDesc: ServiceTypeDesc[_data.rights.rightsType],
              typeDescIcon: _data.rightsType === ServiceType.ONLY_REFUND ? 'money-circle' : 'return-goods-1',
              status: _data.rights.rightsStatus,
              statusName: _data.rights.userRightsStatusName,
              statusDesc: _data.rights.userRightsStatusDesc,
              amount: _data.rights.refundAmount,
              goodsList: _data.rightsItem.map((item, i) => ({
                id: i,
                thumb: item.goodsPictureUrl,
                title: item.goodsName,
                specs: (item.specInfo || []).map((s) => s.specValues || ''),
                itemRefundAmount: item.itemRefundAmount,
                rightsQuantity: item.itemRefundAmount,
              })),
              storeId: _data.storeId,
              buttons: _data.buttonVOs || [],
              logisticsNo: _data.logisticsVO.logisticsNo, // 退货物流单号
              logisticsCompanyName: _data.logisticsVO.logisticsCompanyName, // 退货物流公司
              logisticsCompanyCode: _data.logisticsVO.logisticsCompanyCode, // 退货物流公司
              remark: _data.logisticsVO.remark, // 退货备注
              logisticsVO: _data.logisticsVO,
            };
          });
        }
        return new Promise((resolve) => {
          if (reset) {
            this.setData(
              {
                dataList: [],
              },
              () => resolve(),
            );
          } else resolve();
        }).then(() => {
          this.setData({
            tabs,
            dataList: this.data.dataList.concat(dataList),
            listLoading: dataList.length > 0 ? 0 : 2,
          });
        });
      })
      .catch((err) => {
        this.setData({
          listLoading: 3,
        });
        return Promise.reject(err);
      });
  },

  onReTryLoad() {
    this.getAfterServiceList(this.data.curTab);
  },

  onTabChange(e) {
    const { value } = e.detail;
    const tab = this.data.tabs.find((v) => v.key === value);
    if (!tab) return;
    this.refreshList(value);
  },

  refreshList(status = -1) {
    this.page = {
      size: 10,
      num: 1,
    };
    this.setData({
      curTab: status,
      dataList: [],
    });
    return this.getAfterServiceList(status, true);
  },

  onRefresh() {
    this.refreshList(this.data.curTab);
  },

  // 点击订单卡片
  onAfterServiceCardTap(e) {
    wx.navigateTo({
      url: `/pages/order/after-service-detail/index?rightsNo=${e.currentTarget.dataset.order.id}`,
    });
  },
});
</script>

<template>
<view class="page-container [&_.order-goods-card-footer]:[display:flex] [&_.order-goods-card-footer]:[width:calc(100%_-_190rpx)] [&_.order-goods-card-footer]:[justify-content:space-between] [&_.order-goods-card-footer]:[position:absolute] [&_.order-goods-card-footer]:[bottom:20rpx] [&_.order-goods-card-footer]:[left:190rpx] [&_.order-goods-card-footer_.order-goods-card-footer-num]:[color:#999] [&_.order-goods-card-footer_.order-goods-card-footer-num]:[line-height:40rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-size:36rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-size:28rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-size:24rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-family:DIN_Alternate] [&_.wr-goods-card__specs]:[margin:14rpx_20rpx_0_0] [&_.order-card_.header_.store-name]:[width:80%] [&_.order-card_.header_.store-name]:[-webkit-line-clamp:1] [&_.status-desc]:[box-sizing:border-box] [&_.status-desc]:[padding:22rpx_20rpx] [&_.status-desc]:[font-size:26rpx] [&_.status-desc]:[line-height:1.3] [&_.status-desc]:[text-align:left] [&_.status-desc]:[color:#333333] [&_.status-desc]:[background-color:#f5f5f5] [&_.status-desc]:[border-radius:8rpx] [&_.status-desc]:[word-wrap:break-word] [&_.status-desc]:[margin-top:24rpx] [&_.status-desc]:[margin-bottom:20rpx] [&_.header__right]:[font-size:24rpx] [&_.header__right]:[color:#fa4126] [&_.header__right]:[display:flex] [&_.header__right]:[align-items:center] [&_.header__right__icon]:[color:#d05b27] [&_.header__right__icon]:[font-size:16px] [&_.header__right__icon]:[margin-right:10rpx] [&_.header-class]:[margin-bottom:5rpx]">
  <t-pull-down-refresh id="t-pull-down-refresh" bindrefresh="onPullDownRefresh_" t-class-indicator="t-class-indicator">
    <wr-order-card
      wx:for="{{dataList}}"
      wx:key="id"
      wx:for-item="order"
      wx:for-index="oIndex"
      order="{{order}}"
      data-order="{{order}}"
      bindcardtap="onAfterServiceCardTap"
      useTopRightSlot
      header-class="header-class"
    >
      <view class="text-btn" slot="top-right">
        <view class="header__right">
          <t-icon prefix="wr" color="#FA4126" name="goods_refund" size="20px" slot="left-icon" />
          {{order.typeDesc}}
        </view>
      </view>
      <wr-goods-card
        wx:for="{{order.goodsList}}"
        wx:key="id"
        wx:for-item="goods"
        wx:for-index="gIndex"
        data="{{goods}}"
        no-top-line="{{gIndex === 0}}"
      >
        <view slot="footer" class="order-goods-card-footer">
          <wr-price
            price="{{goods.itemRefundAmount}}"
            fill
            wr-class="order-goods-card-footer-price-class"
            symbol-class="order-goods-card-footer-price-symbol"
            decimal-class="order-goods-card-footer-price-decimal"
          />
          <view class="order-goods-card-footer-num">x {{goods.rightsQuantity}}</view>
        </view>
      </wr-goods-card>
      <view slot="more">
        <view class="status-desc">{{order.statusDesc}}</view>
        <wr-after-service-button-bar service="{{order}}" bindrefresh="onRefresh" />
      </view>
    </wr-order-card>
    <!-- 列表加载中/已全部加载 -->
    <wr-load-more
      wx:if="{{!pullDownRefreshing}}"
      list-is-empty="{{!dataList.length}}"
      status="{{listLoading}}"
      bindretry="onReTryLoad"
    >
      <!-- 空态 -->
      <view slot="empty" class="empty-wrapper [height:calc(100vh_-_88rpx)]">
        <t-empty size="240rpx" textColor="#999999" textSize="28rpx" src="{{emptyImg}}">
          暂无退款或售后申请记录
        </t-empty>
      </view>
    </wr-load-more>
  </t-pull-down-refresh>
</view>
<t-toast id="t-toast" />
<t-dialog id="t-dialog" />
</template>

<json>
{
  "navigationBarTitleText": "退款/售后",
  "usingComponents": {
    "wr-load-more": "/components/load-more/index",
    "wr-after-service-button-bar": "../components/after-service-button-bar/index",
    "wr-price": "/components/price/index",
    "wr-order-card": "../components/order-card/index",
    "wr-goods-card": "../components/goods-card/index",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-pull-down-refresh": "tdesign-miniprogram/pull-down-refresh/pull-down-refresh"
  }
}</json>
