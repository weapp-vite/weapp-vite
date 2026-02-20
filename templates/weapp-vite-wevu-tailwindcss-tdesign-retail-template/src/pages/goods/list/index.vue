<script lang="ts">
import { fetchGoodsList } from '../../../services/good/fetchGoodsList';
import Toast from 'tdesign-miniprogram/toast/index';

const initFilters = {
  overall: 1,
  sorts: '',
  layout: 0,
};

Page({
  data: {
    goodsList: [],
    layout: 0,
    sorts: '',
    overall: 1,
    show: false,
    minVal: '',
    maxVal: '',
    filter: initFilters,
    hasLoaded: false,
    loadMoreStatus: 0,
    loading: true,
  },

  pageNum: 1,
  pageSize: 30,
  total: 0,

  handleFilterChange(e) {
    const { layout, overall, sorts } = e.detail;
    this.pageNum = 1;
    this.setData({
      layout,
      sorts,
      overall,
      loadMoreStatus: 0,
    });
    this.init(true);
  },

  generalQueryData(reset = false) {
    const { filter, keywords, minVal, maxVal } = this.data;
    const { pageNum, pageSize } = this;
    const { sorts, overall } = filter;
    const params = {
      sort: 0, // 0 综合，1 价格
      pageNum: 1,
      pageSize: 30,
      keyword: keywords,
    };

    if (sorts) {
      params.sort = 1;
      params.sortType = sorts === 'desc' ? 1 : 0;
    }

    if (overall) {
      params.sort = 0;
    } else {
      params.sort = 1;
    }
    params.minPrice = minVal ? minVal * 100 : 0;
    params.maxPrice = maxVal ? maxVal * 100 : undefined;
    if (reset) return params;
    return {
      ...params,
      pageNum: pageNum + 1,
      pageSize,
    };
  },

  async init(reset = true) {
    const { loadMoreStatus, goodsList = [] } = this.data;
    const params = this.generalQueryData(reset);
    if (loadMoreStatus !== 0) return;
    this.setData({
      loadMoreStatus: 1,
      loading: true,
    });
    try {
      const result = await fetchGoodsList(params);
      const code = 'Success';
      const data = result;
      if (code.toUpperCase() === 'SUCCESS') {
        const { spuList, totalCount = 0 } = data;
        if (totalCount === 0 && reset) {
          this.total = totalCount;
          this.setData({
            emptyInfo: {
              tip: '抱歉，未找到相关商品',
            },
            hasLoaded: true,
            loadMoreStatus: 0,
            loading: false,
            goodsList: [],
          });
          return;
        }

        const _goodsList = reset ? spuList : goodsList.concat(spuList);
        const _loadMoreStatus = _goodsList.length === totalCount ? 2 : 0;
        this.pageNum = params.pageNum || 1;
        this.total = totalCount;
        this.setData({
          goodsList: _goodsList,
          loadMoreStatus: _loadMoreStatus,
        });
      } else {
        this.setData({
          loading: false,
        });
        wx.showToast({
          title: '查询失败，请稍候重试',
        });
      }
    } catch (error) {
      this.setData({
        loading: false,
      });
    }
    this.setData({
      hasLoaded: true,
      loading: false,
    });
  },

  onLoad() {
    this.init(true);
  },

  onReachBottom() {
    const { goodsList } = this.data;
    const { total = 0 } = this;
    if (goodsList.length === total) {
      this.setData({
        loadMoreStatus: 2,
      });
      return;
    }
    this.init(false);
  },

  handleAddCart() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击加购',
    });
  },

  tagClickHandle() {
    Toast({
      context: this,
      selector: '#t-toast',
      message: '点击标签',
    });
  },

  gotoGoodsDetail(e) {
    const { index } = e.detail;
    const { spuId } = this.data.goodsList[index];
    wx.navigateTo({
      url: `/pages/goods/details/index?spuId=${spuId}`,
    });
  },

  showFilterPopup() {
    this.setData({
      show: true,
    });
  },

  showFilterPopupClose() {
    this.setData({
      show: false,
    });
  },

  onMinValAction(e) {
    const { value } = e.detail;
    this.setData({ minVal: value });
  },

  onMaxValAction(e) {
    const { value } = e.detail;
    this.setData({ maxVal: value });
  },

  reset() {
    this.setData({ minVal: '', maxVal: '' });
  },

  confirm() {
    const { minVal, maxVal } = this.data;
    let message = '';
    if (minVal && !maxVal) {
      message = `价格最小是${minVal}`;
    } else if (!minVal && maxVal) {
      message = `价格范围是0-${minVal}`;
    } else if (minVal && maxVal && minVal <= maxVal) {
      message = `价格范围${minVal}-${this.data.maxVal}`;
    } else {
      message = '请输入正确范围';
    }
    if (message) {
      Toast({
        context: this,
        selector: '#t-toast',
        message,
      });
    }
    this.pageNum = 1;
    this.setData(
      {
        show: false,
        minVal: '',
        goodsList: [],
        loadMoreStatus: 0,
        maxVal: '',
      },
      () => {
        this.init();
      },
    );
  },
});
</script>

<template>
<view class="goods-list-container [display:block] [&_.t-search]:[padding:0_30rpx] [&_.t-search]:[background-color:#fff] [&_.t-class__input-container]:[height:64rpx] [&_.t-class__input-container]:[border-radius:32rpx] [&_.t-search__left-icon]:[display:flex] [&_.t-search__left-icon]:[align-items:center] [&_.t-search__input]:[font-size:28rpx] [&_.t-search__input]:[color:rgb(116,_116,_116)] [&_.category-goods-list]:[background-color:#f2f2f2] [&_.category-goods-list]:[overflow-y:scroll] [&_.category-goods-list]:[-webkit-overflow-scrolling:touch] [&_.category-goods-list]:[padding:20rpx_24rpx] [&_.wr-goods-list]:[background:#f2f2f2] [&_.t-image__mask]:[display:flex] [&_.empty-wrap]:[margin-top:184rpx] [&_.empty-wrap]:[margin-bottom:120rpx] [&_.empty-wrap]:[height:300rpx] [&_.empty-wrap_.empty-tips_.empty-content_.content-text]:[margin-top:40rpx] [&_.price-container]:[padding:32rpx] [&_.price-container]:[height:100vh] [&_.price-container]:[max-width:632rpx] [&_.price-container]:[background-color:#fff] [&_.price-container]:[border-radius:30rpx_0_0_30rpx] [&_.price-container]:[box-sizing:border-box] [&_.price-between]:[font-size:26rpx] [&_.price-between]:[font-weight:500] [&_.price-between]:[color:rgba(51,_51,_51,_1)] [&_.price-ipts-wrap]:[width:100%] [&_.price-ipts-wrap]:[display:flex] [&_.price-ipts-wrap]:[align-items:center] [&_.price-ipts-wrap]:[justify-content:space-around] [&_.price-ipts-wrap]:[margin-top:24rpx] [&_.price-ipts-wrap_.price-divided]:[width:16rpx] [&_.price-ipts-wrap_.price-divided]:[margin:0_24rpx] [&_.price-ipts-wrap_.price-divided]:[color:#333333] [&_.price-ipts-wrap_.t-input__wrapper]:[margin:0] [&_.price-ipts-wrap_.t-input__content]:[font-size:24rpx] [&_.price-ipts-wrap_.t-input__placeholder]:[font-size:24rpx] [&_.price-ipts-wrap_.price-ipt]:[border-radius:8rpx]">
  <filter
    wr-class="filter-container"
    bind:change="handleFilterChange"
    layout="{{layout}}"
    sorts="{{sorts}}"
    overall="{{overall}}"
    bind:showFilterPopup="showFilterPopup"
  >
    <filter-popup
      slot="filterPopup"
      show="{{show}}"
      bind:showFilterPopupClose="showFilterPopupClose"
      bind:reset="reset"
      bind:confirm="confirm"
    >
      <view class="price-container" slot="filterSlot">
        <view class="price-between">价格区间</view>
        <view class="price-ipts-wrap">
          <t-input
            align="center"
            type="number"
            t-class="price-ipt"
            placeholder="最低价"
            value="{{minVal}}"
            bindchange="onMinValAction"
          />
          <view class="price-divided">-</view>
          <t-input
            align="center"
            type="number"
            t-class="price-ipt"
            placeholder="最高价"
            value="{{maxVal}}"
            bindchange="onMaxValAction"
          />
        </view>
      </view>
    </filter-popup>
  </filter>
  <view class="empty-wrap" wx:if="{{goodsList.length === 0 && hasLoaded}}">
    <t-empty t-class="empty-tips" size="240rpx" description="暂无相关商品" />
  </view>
  <view class="category-goods-list" wx:if="{{goodsList.length}}">
    <goods-list
      wr-class="wr-goods-list"
      goodsList="{{goodsList}}"
      bind:click="gotoGoodsDetail"
      bind:addcart="handleAddCart"
    />
  </view>
  <load-more wx:if="{{goodsList.length > 0}}" status="{{loadMoreStatus}}" no-more-text="没有更多了" />
</view>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "商品列表",
  "usingComponents": {
    "t-input": "tdesign-miniprogram/input/input",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "goods-list": "/components/goods-list/index",
    "filter": "/components/filter/index",
    "filter-popup": "/components/filter-popup/index",
    "load-more": "/components/load-more/index"
  }
}</json>
