<script setup lang="ts">
import Toast from 'tdesign-miniprogram/toast/index';
import { fetchGood } from '../../../services/good/fetchGood';
import { fetchActivityList } from '../../../services/activity/fetchActivityList';
import { getGoodsDetailsCommentList, getGoodsDetailsCommentsCount } from '../../../services/good/fetchGoodsDetailsComments';
import { cdnBase } from '../../../config/index';
defineOptions({
  data() {
    return {
      commentsList: [],
      commentsStatistics: {
        badCount: 0,
        commentCount: 0,
        goodCount: 0,
        goodRate: 0,
        hasImageCount: 0,
        middleCount: 0
      },
      isShowPromotionPop: false,
      activityList: [],
      recLeftImg: `${cdnBase}/common/rec-left.png`,
      recRightImg: `${cdnBase}/common/rec-right.png`,
      details: {},
      goodsTabArray: [{
        name: '商品',
        value: '' // 空字符串代表置顶
      }, {
        name: '详情',
        value: 'goods-page'
      }],
      storeLogo: `${cdnBase}/common/store-logo.png`,
      storeName: '云mall标准版旗舰店',
      jumpArray: [{
        title: '首页',
        url: '/pages/home/home',
        iconName: 'home'
      }, {
        title: '购物车',
        url: '/pages/cart/index',
        iconName: 'cart',
        showCartNum: true
      }],
      isStock: true,
      cartNum: 0,
      soldout: false,
      buttonType: 1,
      buyNum: 1,
      selectedAttrStr: '',
      skuArray: [],
      primaryImage: '',
      specImg: '',
      isSpuSelectPopupShow: false,
      isAllSelectedSku: false,
      buyType: 0,
      outOperateStatus: false,
      // 是否外层加入购物车
      operateType: 0,
      selectSkuSellsPrice: 0,
      maxLinePrice: 0,
      minSalePrice: 0,
      maxSalePrice: 0,
      list: [],
      spuId: '',
      navigation: {
        type: 'fraction'
      },
      current: 0,
      autoplay: true,
      duration: 500,
      interval: 5000,
      soldNum: 0 // 已售数量
    };
  },
  obj2Params(obj = {}, encode = false) {
    const result = [];
    Object.keys(obj).forEach(key => result.push(`${key}=${encode ? encodeURIComponent(obj[key]) : obj[key]}`));
    return result.join('&');
  },
  handlePopupHide() {
    this.setData({
      isSpuSelectPopupShow: false
    });
  },
  showSkuSelectPopup(type) {
    this.setData({
      buyType: type || 0,
      outOperateStatus: type >= 1,
      isSpuSelectPopupShow: true
    });
  },
  buyItNow() {
    this.showSkuSelectPopup(1);
  },
  toAddCart() {
    this.showSkuSelectPopup(2);
  },
  toNav(e) {
    const {
      url
    } = e.detail;
    wx.switchTab({
      url: url
    });
  },
  showCurImg(e) {
    const {
      index
    } = e.detail;
    const {
      images
    } = this.data.details;
    wx.previewImage({
      current: images[index],
      urls: images // 需要预览的图片http链接列表
    });
  },
  onPageScroll({
    scrollTop
  }) {
    const goodsTab = this.selectComponent('#goodsTab');
    goodsTab && goodsTab.onScroll(scrollTop);
  },
  chooseSpecItem(e) {
    const {
      specList
    } = this.data.details;
    const {
      selectedSku,
      isAllSelectedSku
    } = e.detail;
    if (!isAllSelectedSku) {
      this.setData({
        selectSkuSellsPrice: 0
      });
    }
    this.setData({
      isAllSelectedSku
    });
    this.getSkuItem(specList, selectedSku);
  },
  getSkuItem(specList, selectedSku) {
    const {
      skuArray,
      primaryImage
    } = this.data;
    const selectedSkuValues = this.getSelectedSkuValues(specList, selectedSku);
    let selectedAttrStr = ` 件  `;
    selectedSkuValues.forEach(item => {
      selectedAttrStr += `，${item.specValue}  `;
    });
    // eslint-disable-next-line array-callback-return
    const skuItem = skuArray.filter(item => {
      let status = true;
      (item.specInfo || []).forEach(subItem => {
        if (!selectedSku[subItem.specId] || selectedSku[subItem.specId] !== subItem.specValueId) {
          status = false;
        }
      });
      if (status) return item;
    });
    this.selectSpecsName(selectedSkuValues.length > 0 ? selectedAttrStr : '');
    if (skuItem) {
      this.setData({
        selectItem: skuItem,
        selectSkuSellsPrice: skuItem.price || 0
      });
    } else {
      this.setData({
        selectItem: null,
        selectSkuSellsPrice: 0
      });
    }
    this.setData({
      specImg: skuItem && skuItem.skuImage ? skuItem.skuImage : primaryImage
    });
  },
  // 获取已选择的sku名称
  getSelectedSkuValues(skuTree, selectedSku) {
    const normalizedTree = this.normalizeSkuTree(skuTree);
    return Object.keys(selectedSku).reduce((selectedValues, skuKeyStr) => {
      const skuValues = normalizedTree[skuKeyStr];
      const skuValueId = selectedSku[skuKeyStr];
      if (skuValueId !== '') {
        const skuValue = skuValues.filter(value => {
          return value.specValueId === skuValueId;
        })[0];
        skuValue && selectedValues.push(skuValue);
      }
      return selectedValues;
    }, []);
  },
  normalizeSkuTree(skuTree) {
    const normalizedTree = {};
    skuTree.forEach(treeItem => {
      normalizedTree[treeItem.specId] = treeItem.specValueList;
    });
    return normalizedTree;
  },
  selectSpecsName(selectSpecsName) {
    if (selectSpecsName) {
      this.setData({
        selectedAttrStr: selectSpecsName
      });
    } else {
      this.setData({
        selectedAttrStr: ''
      });
    }
  },
  addCart() {
    const {
      isAllSelectedSku
    } = this.data;
    Toast({
      context: this,
      selector: '#t-toast',
      message: isAllSelectedSku ? '点击加入购物车' : '请选择规格',
      icon: '',
      duration: 1000
    });
  },
  gotoBuy(type) {
    const {
      isAllSelectedSku,
      buyNum
    } = this.data;
    if (!isAllSelectedSku) {
      Toast({
        context: this,
        selector: '#t-toast',
        message: '请选择规格',
        icon: '',
        duration: 1000
      });
      return;
    }
    this.handlePopupHide();
    const query = {
      quantity: buyNum,
      storeId: '1',
      spuId: this.data.spuId,
      goodsName: this.data.details.title,
      skuId: type === 1 ? this.data.skuList[0].skuId : this.data.selectItem.skuId,
      available: this.data.details.available,
      price: this.data.details.minSalePrice,
      specInfo: this.data.details.specList?.map(item => ({
        specTitle: item.title,
        specValue: item.specValueList[0].specValue
      })),
      primaryImage: this.data.details.primaryImage,
      spuId: this.data.details.spuId,
      thumb: this.data.details.primaryImage,
      title: this.data.details.title
    };
    let urlQueryStr = this.obj2Params({
      goodsRequestList: JSON.stringify([query])
    });
    urlQueryStr = urlQueryStr ? `?${urlQueryStr}` : '';
    const path = `/pages/order/order-confirm/index${urlQueryStr}`;
    wx.navigateTo({
      url: path
    });
  },
  specsConfirm() {
    const {
      buyType
    } = this.data;
    if (buyType === 1) {
      this.gotoBuy();
    } else {
      this.addCart();
    }
    // this.handlePopupHide();
  },
  changeNum(e) {
    this.setData({
      buyNum: e.detail.buyNum
    });
  },
  closePromotionPopup() {
    this.setData({
      isShowPromotionPop: false
    });
  },
  promotionChange(e) {
    const {
      index
    } = e.detail;
    wx.navigateTo({
      url: `/pages/promotion/promotion-detail/index?promotion_id=${index}`
    });
  },
  showPromotionPopup() {
    this.setData({
      isShowPromotionPop: true
    });
  },
  getDetail(spuId) {
    Promise.all([fetchGood(spuId), fetchActivityList()]).then(res => {
      const [details, activityList] = res;
      const skuArray = [];
      const {
        skuList,
        primaryImage,
        isPutOnSale,
        minSalePrice,
        maxSalePrice,
        maxLinePrice,
        soldNum
      } = details;
      skuList.forEach(item => {
        skuArray.push({
          skuId: item.skuId,
          quantity: item.stockInfo ? item.stockInfo.stockQuantity : 0,
          specInfo: item.specInfo
        });
      });
      const promotionArray = [];
      activityList.forEach(item => {
        promotionArray.push({
          tag: item.promotionSubCode === 'MYJ' ? '满减' : '满折',
          label: '满100元减99.9元'
        });
      });
      this.setData({
        details,
        activityList,
        isStock: details.spuStockQuantity > 0,
        maxSalePrice: maxSalePrice ? parseInt(maxSalePrice) : 0,
        maxLinePrice: maxLinePrice ? parseInt(maxLinePrice) : 0,
        minSalePrice: minSalePrice ? parseInt(minSalePrice) : 0,
        list: promotionArray,
        skuArray: skuArray,
        primaryImage,
        soldout: isPutOnSale === 0,
        soldNum
      });
    });
  },
  async getCommentsList() {
    try {
      const code = 'Success';
      const data = await getGoodsDetailsCommentList();
      const {
        homePageComments
      } = data;
      if (code.toUpperCase() === 'SUCCESS') {
        const nextState = {
          commentsList: homePageComments.map(item => {
            return {
              goodsSpu: item.spuId,
              userName: item.userName || '',
              commentScore: item.commentScore,
              commentContent: item.commentContent || '用户未填写评价',
              userHeadUrl: item.isAnonymity ? this.anonymityAvatar : item.userHeadUrl || this.anonymityAvatar
            };
          })
        };
        this.setData(nextState);
      }
    } catch (error) {
      console.error('comments error:', error);
    }
  },
  onShareAppMessage() {
    // 自定义的返回信息
    const {
      selectedAttrStr
    } = this.data;
    let shareSubTitle = '';
    if (selectedAttrStr.indexOf('件') > -1) {
      const count = selectedAttrStr.indexOf('件');
      shareSubTitle = selectedAttrStr.slice(count + 1, selectedAttrStr.length);
    }
    const customInfo = {
      imageUrl: this.data.details.primaryImage,
      title: this.data.details.title + shareSubTitle,
      path: `/pages/goods/details/index?spuId=${this.data.spuId}`
    };
    return customInfo;
  },
  /** 获取评价统计 */
  async getCommentsStatistics() {
    try {
      const code = 'Success';
      const data = await getGoodsDetailsCommentsCount();
      if (code.toUpperCase() === 'SUCCESS') {
        const {
          badCount,
          commentCount,
          goodCount,
          goodRate,
          hasImageCount,
          middleCount
        } = data;
        const nextState = {
          commentsStatistics: {
            badCount: parseInt(`${badCount}`),
            commentCount: parseInt(`${commentCount}`),
            goodCount: parseInt(`${goodCount}`),
            /** 后端返回百分比后数据但没有限制位数 */
            goodRate: Math.floor(goodRate * 10) / 10,
            hasImageCount: parseInt(`${hasImageCount}`),
            middleCount: parseInt(`${middleCount}`)
          }
        };
        this.setData(nextState);
      }
    } catch (error) {
      console.error('comments statiistics error:', error);
    }
  },
  /** 跳转到评价列表 */
  navToCommentsListPage() {
    wx.navigateTo({
      url: `/pages/goods/comments/index?spuId=${this.data.spuId}`
    });
  },
  onLoad(query) {
    const {
      spuId
    } = query;
    this.setData({
      spuId: spuId
    });
    this.getDetail(spuId);
    this.getCommentsList(spuId);
    this.getCommentsStatistics(spuId);
  }
});
</script>

<template>
<view class="goods-detail-page [&_.goods-info]:[margin:0_auto] [&_.goods-info]:[padding:26rpx_0_28rpx_30rpx] [&_.goods-info]:[background-color:#fff] [&_.swipe-img]:[width:100%] [&_.swipe-img]:[height:750rpx] [&_.goods-info_.goods-price]:[display:flex] [&_.goods-info_.goods-price]:[align-items:baseline] [&_.goods-info_.goods-price-up]:[color:#fa4126] [&_.goods-info_.goods-price-up]:[font-size:28rpx] [&_.goods-info_.goods-price-up]:[position:relative] [&_.goods-info_.goods-price-up]:[bottom:4rpx] [&_.goods-info_.goods-price-up]:[left:8rpx] [&_.goods-info_.goods-price_.class-goods-price]:[font-size:64rpx] [&_.goods-info_.goods-price_.class-goods-price]:[color:#fa4126] [&_.goods-info_.goods-price_.class-goods-price]:[font-weight:bold] [&_.goods-info_.goods-price_.class-goods-price]:[font-family:DIN_Alternate] [&_.goods-info_.goods-price_.class-goods-symbol]:[font-size:36rpx] [&_.goods-info_.goods-price_.class-goods-symbol]:[color:#fa4126] [&_.goods-info_.goods-price_.class-goods-del]:[position:relative] [&_.goods-info_.goods-price_.class-goods-del]:[font-weight:normal] [&_.goods-info_.goods-price_.class-goods-del]:[left:16rpx] [&_.goods-info_.goods-price_.class-goods-del]:[bottom:2rpx] [&_.goods-info_.goods-price_.class-goods-del]:[color:#999999] [&_.goods-info_.goods-price_.class-goods-del]:[font-size:32rpx] [&_.goods-info_.goods-number]:[display:flex] [&_.goods-info_.goods-number]:[align-items:center] [&_.goods-info_.goods-number]:[justify-content:space-between] [&_.goods-info_.goods-number_.sold-num]:[font-size:24rpx] [&_.goods-info_.goods-number_.sold-num]:[color:#999999] [&_.goods-info_.goods-number_.sold-num]:[display:flex] [&_.goods-info_.goods-number_.sold-num]:[align-items:flex-end] [&_.goods-info_.goods-number_.sold-num]:[margin-right:32rpx] [&_.goods-info_.goods-activity]:[display:flex] [&_.goods-info_.goods-activity]:[margin-top:16rpx] [&_.goods-info_.goods-activity]:[justify-content:space-between] [&_.goods-info_.goods-activity_.tags-container]:[display:flex] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[background:#ffece9] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[color:#fa4126] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[font-size:24rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[margin-right:16rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[padding:4rpx_8rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[border-radius:4rpx] [&_.goods-info_.goods-activity_.activity-show]:[display:flex] [&_.goods-info_.goods-activity_.activity-show]:[justify-content:center] [&_.goods-info_.goods-activity_.activity-show]:[align-items:center] [&_.goods-info_.goods-activity_.activity-show]:[color:#fa4126] [&_.goods-info_.goods-activity_.activity-show]:[font-size:24rpx] [&_.goods-info_.goods-activity_.activity-show]:[padding-right:32rpx] [&_.goods-info_.goods-activity_.activity-show-text]:[line-height:42rpx] [&_.goods-info_.goods-title]:[display:flex] [&_.goods-info_.goods-title]:[justify-content:space-between] [&_.goods-info_.goods-title]:[align-items:center] [&_.goods-info_.goods-title]:[margin-top:20rpx] [&_.goods-info_.goods-title_.goods-name]:[width:600rpx] [&_.goods-info_.goods-title_.goods-name]:[font-weight:500] [&_.goods-info_.goods-title_.goods-name]:[display:-webkit-box] [&_.goods-info_.goods-title_.goods-name]:[-webkit-box-orient:vertical] [&_.goods-info_.goods-title_.goods-name]:[-webkit-line-clamp:2] [&_.goods-info_.goods-title_.goods-name]:[overflow:hidden] [&_.goods-info_.goods-title_.goods-name]:[font-size:32rpx] [&_.goods-info_.goods-title_.goods-name]:[word-break:break-all] [&_.goods-info_.goods-title_.goods-name]:[color:#333333] [&_.goods-info_.goods-title_.goods-tag]:[width:104rpx] [&_.goods-info_.goods-title_.goods-tag]:[margin-left:26rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[border-radius:200rpx_0px_0px_200rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[width:100rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[height:96rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[border:none] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[padding-right:36rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[font-size:20rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[display:flex] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[flex-direction:column] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[align-items:center] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[justify-content:center] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[height:96rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[color:#999] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:[padding-top:8rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:[font-size:20rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:[line-height:24rpx] [&_.goods-info_.goods-intro]:[font-size:26rpx] [&_.goods-info_.goods-intro]:[color:#888] [&_.goods-info_.goods-intro]:[line-height:36rpx] [&_.goods-info_.goods-intro]:[word-break:break-all] [&_.goods-info_.goods-intro]:[padding-right:30rpx] [&_.goods-info_.goods-intro]:[display:-webkit-box] [&_.goods-info_.goods-intro]:[-webkit-line-clamp:2] [&_.goods-info_.goods-intro]:[-webkit-box-orient:vertical] [&_.goods-info_.goods-intro]:[white-space:normal] [&_.goods-info_.goods-intro]:[overflow:hidden] [&_.desc-content]:[margin-top:20rpx] [&_.desc-content]:[background-color:#fff] [&_.desc-content]:[padding-bottom:120rpx] [&_.desc-content__title]:[font-size:28rpx] [&_.desc-content__title]:[line-height:36rpx] [&_.desc-content__title]:[text-align:center] [&_.desc-content__title]:[display:flex] [&_.desc-content__title]:[justify-content:center] [&_.desc-content__title]:[align-items:center] [&_.desc-content__title]:[padding:30rpx_20rpx] [&_.desc-content__title_.img]:[width:206rpx] [&_.desc-content__title_.img]:[height:10rpx] [&_.desc-content__title--text]:[font-size:26rpx] [&_.desc-content__title--text]:[margin:0_32rpx] [&_.desc-content__title--text]:[font-weight:600] [&_.desc-content__img]:[width:100%] [&_.desc-content__img]:[height:auto]">
  <view class="goods-head">
    <t-swiper
      wx:if="{{details.images.length > 0}}"
      height="750rpx"
      current="{{current}}"
      autoplay="{{autoplay}}"
      duration="{{duration}}"
      interval="{{interval}}"
      navigation="{{navigation}}"
      list="{{details.images}}"
    ></t-swiper>
    <view class="goods-info">
      <view class="goods-number">
        <view class="goods-price">
          <price
            wr-class="class-goods-price"
            symbol-class="class-goods-symbol"
            price="{{minSalePrice}}"
            type="lighter"
          />
          <view class="goods-price-up">起</view>
          <price wr-class="class-goods-del" price="{{maxLinePrice}}" type="delthrough" />
        </view>
        <view class="sold-num">已售{{soldNum}}</view>
      </view>
      <view wx:if="{{activityList.length > 0}}" class="goods-activity" bindtap="showPromotionPopup">
        <view class="tags-container">
          <view wx:for="{{activityList}}" data-promotionId="{{item.promotionId}}" wx:key="index" wx:if="{{index<4}}">
            <view class="goods-activity-tag">{{item.tag}}</view>
          </view>
        </view>
        <view class="activity-show">
          <view class="activity-show-text">领劵</view>
          <t-icon name="chevron-right" size="42rpx" />
        </view>
      </view>
      <view class="goods-title">
        <view class="goods-name">{{details.title}}</view>
        <view class="goods-tag">
          <t-button open-type="share" t-class="shareBtn" variant="text">
            <view class="btn-icon">
              <t-icon name="share" size="40rpx" color="#000" />
              <view class="share-text">分享</view>
            </view>
          </t-button>
        </view>
      </view>
      <view class="goods-intro">{{intro}}</view>
    </view>
    <view class="spu-select [height:80rpx] [background-color:#fff] [margin-top:20rpx] [display:flex] [align-items:center] [padding:30rpx] [font-size:28rpx] [&_.label]:[margin-right:30rpx] [&_.label]:[text-align:center] [&_.label]:[flex-shrink:0] [&_.label]:[color:#999999] [&_.label]:[font-weight:normal] [&_.content]:[display:flex] [&_.content]:[flex:1] [&_.content]:[justify-content:space-between] [&_.content]:[align-items:center] [&_.content_.tintColor]:[color:#aaa]" bindtap="showSkuSelectPopup">
      <view class="label">已选</view>
      <view class="content">
        <view class="{{!selectedAttrStr ? 'tintColor' : ''}}">
          {{selectedAttrStr ? buyNum : ''}}{{selectedAttrStr || '请选择'}}
        </view>
        <t-icon name="chevron-right" size="40rpx" color="#BBBBBB" />
      </view>
    </view>
    <view wx:if="{{ commentsStatistics.commentCount > 0 }}" class="comments-wrap [margin-top:20rpx] [padding:32rpx] [background-color:#fff] [&_.comments-head]:[display:flex] [&_.comments-head]:[flex-direction:row] [&_.comments-head]:[align-items:center] [&_.comments-head]:[justify-content:space-between] [&_.comments-head_.comments-title-wrap]:[display:flex]">
      <view class="comments-head" bindtap="navToCommentsListPage">
        <view class="comments-title-wrap">
          <view class="comments-title-label [color:#333333] [font-size:32rpx] [font-weight:500] [line-height:48rpx]">商品评价</view>
          <view class="comments-title-count [color:#333333] [font-size:32rpx] [font-weight:500] [line-height:48rpx]"> ({{ commentsStatistics.commentCount }}) </view>
        </view>
        <view class="comments-rate-wrap [display:flex] [justify-content:center] [align-items:center] [font-size:24rpx] [&_.comments-good-rate]:[color:#999999] [&_.comments-good-rate]:[font-size:26rpx] [&_.comments-good-rate]:[font-weight:400] [&_.comments-good-rate]:[font-style:normal] [&_.comments-good-rate]:[line-height:36rpx]">
          <view class="comments-good-rate">{{commentsStatistics.goodRate}}% 好评</view>
          <t-icon name="chevron-right" size="40rpx" color="#BBBBBB" />
        </view>
      </view>
      <view class="comment-item-wrap [&_.comment-item-head]:[display:flex] [&_.comment-item-head]:[flex-direction:row] [&_.comment-item-head]:[align-items:center] [&_.comment-item-head]:[margin-top:32rpx] [&_.comment-item-head_.comment-item-avatar]:[width:64rpx] [&_.comment-item-head_.comment-item-avatar]:[height:64rpx] [&_.comment-item-head_.comment-item-avatar]:[border-radius:64rpx] [&_.comment-item-head_.comment-head-right]:[margin-left:24rpx] [&_.comment-item-content]:[margin-top:20rpx] [&_.comment-item-content]:[color:#333333] [&_.comment-item-content]:[line-height:40rpx] [&_.comment-item-content]:[font-size:28rpx] [&_.comment-item-content]:[font-weight:400]" wx:for="{{ commentsList }}" wx:for-item="commentItem" wx:key="goodsSpu">
        <view class="comment-item-head">
          <t-image src="{{commentItem.userHeadUrl}}" t-class="comment-item-avatar" />
          <view class="comment-head-right [&_.comment-username]:[font-size:26rpx] [&_.comment-username]:[color:#333333] [&_.comment-username]:[line-height:36rpx] [&_.comment-username]:[font-weight:400]">
            <view class="comment-username">{{commentItem.userName}}</view>
            <t-rate
              value="{{ commentItem.commentScore }}"
              count="{{5}}"
              size="12"
              gap="2"
              color="{{['#ffc51c', '#ddd']}}"
            />
          </view>
        </view>
        <view class="comment-item-content"> {{commentItem.commentContent}} </view>
      </view>
    </view>
  </view>
  <view class="desc-content">
    <view class="desc-content__title" wx:if="{{details.desc.length > 0}}">
      <t-image t-class="img" src="{{recLeftImg}}" />
      <span class="desc-content__title--text">详情介绍</span>
      <t-image t-class="img" src="{{recRightImg}}" />
    </view>
    <view wx:if="{{details.desc.length > 0}}" wx:for="{{details.desc}}" wx:key="index">
      <t-image t-class="desc-content__img" src="{{item}}" mode="widthFix" />
    </view>
  </view>
  <view class="goods-bottom-operation [position:fixed] [left:0] [bottom:0] [width:100%] [background-color:#fff] [padding-bottom:env(safe-area-inset-bottom)]">
    <buy-bar
      jumpArray="{{jumpArray}}"
      soldout="{{soldout}}"
      isStock="{{isStock}}"
      shopCartNum="{{cartNum}}"
      buttonType="{{buttonType}}"
      bind:toAddCart="toAddCart"
      bind:toNav="toNav"
      bind:toBuyNow="buyItNow"
      class="goods-details-card"
    />
  </view>
  <goods-specs-popup
    id="goodsSpecsPopup"
    show="{{isSpuSelectPopupShow}}"
    title="{{details.title || ''}}"
    src="{{specImg ? specImg : primaryImage}}"
    specList="{{details.specList || []}}"
    skuList="{{skuArray}}"
    limitBuyInfo="{{details.limitInfo[0].text || ''}}"
    bind:closeSpecsPopup="handlePopupHide"
    bind:change="chooseSpecItem"
    bind:changeNum="changeNum"
    bind:addCart="addCart"
    bind:buyNow="gotoBuy"
    bind:specsConfirm="specsConfirm"
    isStock="{{isStock}}"
    outOperateStatus="{{outOperateStatus}}"
  >
    <view slot="goods-price">
      <view class="popup-sku__price">
        <price
          wx:if="{{!isAllSelectedSku || (!promotionSubCode && isAllSelectedSku)}}"
          price="{{selectSkuSellsPrice ? selectSkuSellsPrice : minSalePrice }}"
          wr-class="popup-sku__price-num"
          symbol-class="popup-sku__price-symbol"
        />
        <price
          wx:if="{{selectSkuSellsPrice === 0 && minSalePrice !== maxSalePrice && !isAllSelectedSku}}"
          price="{{maxSalePrice}}"
          wr-class="popup-sku__price-del"
          type="delthrough"
        />
      </view>
    </view>
  </goods-specs-popup>
  <promotion-popup
    list="{{list}}"
    bind:closePromotionPopup="closePromotionPopup"
    show="{{isShowPromotionPop}}"
    bind:promotionChange="promotionChange"
  />
</view>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "商品详情",
  "usingComponents": {
    "t-image": "/components/webp-image/index",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-rate": "tdesign-miniprogram/rate/rate",
    "t-swiper": "tdesign-miniprogram/swiper/swiper",
    "t-swiper-nav": "tdesign-miniprogram/swiper-nav/swiper-nav",
    "t-button": "tdesign-miniprogram/button/button",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-popup": "tdesign-miniprogram/popup/popup",
    "price": "/components/price/index",
    "buy-bar": "./components/buy-bar/index",
    "promotion-popup": "./components/promotion-popup/index",
    "goods-specs-popup": "./components/goods-specs-popup/index"
  }
}</json>
