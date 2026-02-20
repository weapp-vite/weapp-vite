<script lang="ts">
import { fetchHome } from '../../services/home/home';
import { fetchGoodsList } from '../../services/good/fetchGoods';
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    imgSrcs: [],
    tabList: [],
    goodsList: [],
    goodsListLoadStatus: 0,
    pageLoading: false,
    current: 1,
    autoplay: true,
    duration: '500',
    interval: 5000,
    navigation: { type: 'dots' },
    swiperImageProps: { mode: 'scaleToFill' },
  },

  goodListPagination: {
    index: 0,
    num: 20,
  },

  privateData: {
    tabIndex: 0,
  },

  onShow() {
    this.getTabBar().init();
  },

  onLoad() {
    this.init();
  },

  onReachBottom() {
    if (this.data.goodsListLoadStatus === 0) {
      this.loadGoodsList();
    }
  },

  onPullDownRefresh() {
    this.init();
  },

  init() {
    this.loadHomePage();
  },

  loadHomePage() {
    wx.stopPullDownRefresh();

    this.setData({
      pageLoading: true,
    });
    fetchHome().then(({ swiper, tabList }) => {
      this.setData({
        tabList,
        imgSrcs: swiper,
        pageLoading: false,
      });
      this.loadGoodsList(true);
    });
  },

  tabChangeHandle(e) {
    this.privateData.tabIndex = e.detail;
    this.loadGoodsList(true);
  },

  onReTry() {
    this.loadGoodsList();
  },

  async loadGoodsList(fresh = false) {
    if (fresh) {
      wx.pageScrollTo({
        scrollTop: 0,
      });
    }

    this.setData({ goodsListLoadStatus: 1 });

    const pageSize = this.goodListPagination.num;
    let pageIndex = this.privateData.tabIndex * pageSize + this.goodListPagination.index + 1;
    if (fresh) {
      pageIndex = 0;
    }

    try {
      const nextList = await fetchGoodsList(pageIndex, pageSize);
      this.setData({
        goodsList: fresh ? nextList : this.data.goodsList.concat(nextList),
        goodsListLoadStatus: 0,
      });

      this.goodListPagination.index = pageIndex;
      this.goodListPagination.num = pageSize;
    } catch (err) {
      this.setData({ goodsListLoadStatus: 3 });
    }
  },

  goodListClickHandle(e) {
    const { index } = e.detail;
    const { spuId } = this.data.goodsList[index];
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`,
    });
  },

  goodListAddCartHandle() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击加入购物车',
    });
  },

  navToSearchPage() {
    wx.navigateTo({ url: '/pages/goods/search/index' });
  },

  navToActivityDetail({ detail }) {
    const { index: promotionID = 0 } = detail || {};
    wx.navigateTo({
      url: `/pages/promotion/promotion-detail/index?promotion_id=${promotionID}`,
    });
  },
});
</script>

<template>
<view style="text-align: center; color: #b9b9b9" wx:if="{{pageLoading}}">
  <t-loading theme="circular" size="40rpx" text="加载中..." inherit-color />
</view>
<view class="home-page-header [background:linear-gradient(#fff,_#f5f5f5)] [display:block] [padding:0_24rpx] [&_.t-search__input-container]:[border-radius:32rpx] [&_.t-search__input-container]:[height:64rpx] [&_.t-search__input]:[font-size:28rpx] [&_.t-search__input]:[color:rgb(116,_116,_116)] [&_.swiper-wrap]:[margin-top:20rpx] [&_.t-image__swiper]:[width:100%] [&_.t-image__swiper]:[height:300rpx] [&_.t-image__swiper]:[border-radius:10rpx]">
  <view class="search" bind:tap="navToSearchPage">
    <t-search
      t-class-input="t-search__input"
      t-class-input-container="t-search__input-container"
      placeholder="iphone 13 火热发售中"
      leftIcon=""
      disabled
    >
      <t-icon slot="left-icon" prefix="wr" name="search" size="40rpx" color="#bbb" />
    </t-search>
  </view>
  <view class="swiper-wrap">
    <t-swiper
      wx:if="{{imgSrcs.length > 0}}"
      current="{{current}}"
      autoplay="{{autoplay}}"
      duration="{{duration}}"
      interval="{{interval}}"
      navigation="{{navigation}}"
      imageProps="{{swiperImageProps}}"
      list="{{imgSrcs}}"
      bind:click="navToActivityDetail"
    />
  </view>
</view>
<view class="home-page-container [background:#f5f5f5] [display:block] [padding:0_24rpx] [&_.t-tabs]:[background:#f5f5f5] [&_.t-tabs_.t-tabs-nav]:[background-color:transparent] [&_.t-tabs_.t-tabs-nav]:[line-height:80rpx] [&_.t-tabs_.t-tabs-nav]:[font-size:28rpx] [&_.t-tabs_.t-tabs-nav]:[color:#333] [&_.t-tabs_.t-tabs-scroll]:[border:none] [&_.tab_.order-nav_.order-nav-item_.scroll-width]:[min-width:165rpx] [&_.tab_.order-nav-item_.active]:[color:#fa550f] [&_.tab_.bottom-line]:[border-radius:4rpx] [&_.tab_.order-nav-item_.active_.bottom-line]:[background-color:#fa550f] [&_.tabs-external__item]:[font-size:28rpx] [&_.tabs-external__active]:[color:#333333] [&_.tabs-external__active]:[font-size:32rpx] [&_.tabs-external__track]:[height:6rpx] [&_.tabs-external__track]:[border-radius:4rpx] [&_.tabs-external__track]:[width:48rpx] [&_.goods-list-container]:[background:#f5f5f5] [&_.goods-list-container]:[margin-top:16rpx]">
  <view class="home-page-tabs [--td-tab-nav-bg-color:transparent] [--td-tab-border-color:transparent] [--td-tab-item-color:#666] [--td-tab-track-color:red]">
    <t-tabs
      t-class="t-tabs [&_.t-tabs--top_.t-tabs__scroll]:[border-bottom:none] [&_.t-tabs--top_.t-tabs__item]:[height:86rpx] [&_.t-tabs--bottom_.t-tabs__item]:[height:86rpx]"
      t-class-active="tabs-external__active"
      t-class-item="tabs-external__item"
      defaultValue="{{0}}"
      space-evenly="{{false}}"
      bind:change="tabChangeHandle"
    >
      <t-tab-panel
        wx:for="{{tabList}}"
        wx:for-index="index"
        wx:key="index"
        label="{{item.text}}"
        value="{{item.key}}"
      />
    </t-tabs>
  </view>

  <goods-list
    wr-class="goods-list-container"
    goodsList="{{goodsList}}"
    bind:click="goodListClickHandle"
    bind:addcart="goodListAddCartHandle"
  />
  <load-more list-is-empty="{{!goodsList.length}}" status="{{goodsListLoadStatus}}" bind:retry="onReTry" />
  <t-toast id="t-toast" />
</view>
</template>

<json>
{
  "navigationBarTitleText": "首页",
  "onReachBottomDistance": 10,
  "backgroundTextStyle": "light",
  "enablePullDownRefresh": true,
  "usingComponents": {
    "t-search": "tdesign-miniprogram/search/search",
    "t-loading": "tdesign-miniprogram/loading/loading",
    "t-swiper": "tdesign-miniprogram/swiper/swiper",
    "t-swiper-nav": "tdesign-miniprogram/swiper-nav/swiper-nav",
    "t-image": "/components/webp-image/index",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-tabs": "tdesign-miniprogram/tabs/tabs",
    "t-tab-panel": "tdesign-miniprogram/tab-panel/tab-panel",
    "goods-list": "/components/goods-list/index",
    "load-more": "/components/load-more/index"
  }
}</json>
