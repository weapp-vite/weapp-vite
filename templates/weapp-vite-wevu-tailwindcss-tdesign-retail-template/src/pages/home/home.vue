<script setup lang="ts">
import { fetchHome } from '../../services/home/home';
import { fetchGoodsList } from '../../services/good/fetchGoods';
import { onLoad, onPullDownRefresh, onReachBottom, onShow, ref, useNativeInstance } from 'wevu';
import Toast from 'tdesign-miniprogram/toast/index';

interface TabItem {
  text?: string
  key?: number
}

interface GoodsItem {
  spuId?: string | number
  [key: string]: unknown
}

const nativeInstance = useNativeInstance() as any;

const imgSrcs = ref<string[]>([]);
const tabList = ref<TabItem[]>([]);
const goodsList = ref<GoodsItem[]>([]);
const goodsListLoadStatus = ref(0);
const pageLoading = ref(false);
const current = ref(1);
const autoplay = ref(true);
const duration = ref('500');
const interval = ref(5000);
const navigation = ref({ type: 'dots' });
const swiperImageProps = ref({ mode: 'scaleToFill' });

const tabIndex = ref(0);
const goodListPagination = {
  index: 0,
  num: 20,
};

function init() {
  void loadHomePage();
}

async function loadHomePage() {
  wx.stopPullDownRefresh();
  pageLoading.value = true;
  try {
    const { swiper, tabList: nextTabList } = await fetchHome();
    tabList.value = Array.isArray(nextTabList) ? nextTabList : [];
    imgSrcs.value = Array.isArray(swiper) ? swiper : [];
    await loadGoodsList(true);
  }
  finally {
    pageLoading.value = false;
  }
}

function resolveTabValue(detail: unknown) {
  if (typeof detail === 'number') {
    return detail;
  }
  if (detail && typeof detail === 'object' && typeof (detail as any).value === 'number') {
    return (detail as any).value;
  }
  return Number(detail) || 0;
}

function tabChangeHandle(e: any) {
  tabIndex.value = resolveTabValue(e?.detail);
  void loadGoodsList(true);
}

function onReTry() {
  void loadGoodsList();
}

async function loadGoodsList(fresh = false) {
  if (fresh) {
    wx.pageScrollTo({
      scrollTop: 0,
    });
  }

  goodsListLoadStatus.value = 1;

  const pageSize = goodListPagination.num;
  let pageIndex = tabIndex.value * pageSize + goodListPagination.index + 1;
  if (fresh) {
    pageIndex = 0;
  }

  try {
    const nextList = await fetchGoodsList(pageIndex, pageSize) as GoodsItem[];
    goodsList.value = fresh ? nextList : goodsList.value.concat(nextList);
    goodsListLoadStatus.value = 0;
    goodListPagination.index = pageIndex;
    goodListPagination.num = pageSize;
  }
  catch {
    goodsListLoadStatus.value = 3;
  }
}

function goodListClickHandle(e: any) {
  const index = Number(e?.detail?.index);
  if (!Number.isFinite(index) || index < 0) {
    return;
  }
  const spuId = goodsList.value[index]?.spuId;
  if (spuId == null) {
    return;
  }
  wx.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  });
}

function goodListAddCartHandle() {
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message: '点击加入购物车',
  });
}

function navToSearchPage() {
  wx.navigateTo({
    url: '/pages/goods/search/index',
  });
}

function navToActivityDetail({ detail }: { detail?: { index?: number } }) {
  const promotionID = detail?.index ?? 0;
  wx.navigateTo({
    url: `/pages/promotion/promotion-detail/index?promotion_id=${promotionID}`,
  });
}

onShow(() => {
  nativeInstance.getTabBar?.()?.init?.();
});

onLoad(() => {
  init();
});

onReachBottom(() => {
  if (goodsListLoadStatus.value === 0) {
    void loadGoodsList();
  }
});

onPullDownRefresh(() => {
  init();
});

defineExpose({
  imgSrcs,
  tabList,
  goodsList,
  goodsListLoadStatus,
  pageLoading,
  current,
  autoplay,
  duration,
  interval,
  navigation,
  swiperImageProps,
  tabChangeHandle,
  onReTry,
  goodListClickHandle,
  goodListAddCartHandle,
  navToSearchPage,
  navToActivityDetail,
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
