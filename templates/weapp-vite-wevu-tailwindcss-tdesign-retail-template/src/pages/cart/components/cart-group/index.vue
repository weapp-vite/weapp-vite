<script setup lang="ts">
import Toast from 'tdesign-miniprogram/toast/index';
const shortageImg = 'https://tdesign.gtimg.com/miniprogram/template/retail/cart/shortage.png';
defineOptions({
  isSpecsTap: false,
  // 标记本次点击事件是否因为点击specs触发（由于底层goods-card组件没有catch specs点击事件，只能在此处加状态来避免点击specs时触发跳转商品详情）
  externalClasses: ['wr-class'],
  properties: {
    storeGoods: {
      type: Array,
      observer(storeGoods) {
        for (const store of storeGoods) {
          for (const activity of store.promotionGoodsList) {
            for (const goods of activity.goodsPromotionList) {
              goods.specs = goods.specInfo.map(item => item.specValue); // 目前仅展示商品已选规格的值
            }
          }
          for (const goods of store.shortageGoodsList) {
            goods.specs = goods.specInfo.map(item => item.specValue); // 目前仅展示商品已选规格的值
          }
        }
        this.setData({
          _storeGoods: storeGoods
        });
      }
    },
    invalidGoodItems: {
      type: Array,
      observer(invalidGoodItems) {
        invalidGoodItems.forEach(goods => {
          goods.specs = goods.specInfo.map(item => item.specValue); // 目前仅展示商品已选规格的值
        });
        this.setData({
          _invalidGoodItems: invalidGoodItems
        });
      }
    },
    thumbWidth: {
      type: null
    },
    thumbHeight: {
      type: null
    }
  },
  data() {
    return {
      shortageImg,
      isShowSpecs: false,
      currentGoods: {},
      isShowToggle: false,
      _storeGoods: [],
      _invalidGoodItems: []
    };
  },
  methods: {
    // 删除商品
    deleteGoods(e) {
      const {
        goods
      } = e.currentTarget.dataset;
      this.triggerEvent('delete', {
        goods
      });
    },
    // 清空失效商品
    clearInvalidGoods() {
      this.triggerEvent('clearinvalidgoods');
    },
    // 选中商品
    selectGoods(e) {
      const {
        goods
      } = e.currentTarget.dataset;
      this.triggerEvent('selectgoods', {
        goods,
        isSelected: !goods.isSelected
      });
    },
    changeQuantity(num, goods) {
      this.triggerEvent('changequantity', {
        goods,
        quantity: num
      });
    },
    changeStepper(e) {
      const {
        value
      } = e.detail;
      const {
        goods
      } = e.currentTarget.dataset;
      let num = value;
      if (value > goods.stack) {
        num = goods.stack;
      }
      this.changeQuantity(num, goods);
    },
    input(e) {
      const {
        value
      } = e.detail;
      const {
        goods
      } = e.currentTarget.dataset;
      const num = value;
      this.changeQuantity(num, goods);
    },
    overlimit(e) {
      const text = e.detail.type === 'minus' ? '该商品数量不能减少了哦' : '同一商品最多购买999件';
      Toast({
        context: this,
        selector: '#t-toast',
        message: text
      });
    },
    // 去凑单/再逛逛
    gotoBuyMore(e) {
      const {
        promotion,
        storeId = ''
      } = e.currentTarget.dataset;
      this.triggerEvent('gocollect', {
        promotion,
        storeId
      });
    },
    // 选中门店
    selectStore(e) {
      const {
        storeIndex
      } = e.currentTarget.dataset;
      const store = this.data.storeGoods[storeIndex];
      const isSelected = !store.isSelected;
      if (store.storeStockShortage && isSelected) {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '部分商品库存不足'
        });
        return;
      }
      this.triggerEvent('selectstore', {
        store,
        isSelected
      });
    },
    // 展开/收起切换
    showToggle() {
      this.setData({
        isShowToggle: !this.data.isShowToggle
      });
    },
    // 展示规格popup
    specsTap(e) {
      this.isSpecsTap = true;
      const {
        goods
      } = e.currentTarget.dataset;
      this.setData({
        isShowSpecs: true,
        currentGoods: goods
      });
    },
    hideSpecsPopup() {
      this.setData({
        isShowSpecs: false
      });
    },
    goGoodsDetail(e) {
      if (this.isSpecsTap) {
        this.isSpecsTap = false;
        return;
      }
      const {
        goods
      } = e.currentTarget.dataset;
      this.triggerEvent('goodsclick', {
        goods
      });
    },
    gotoCoupons() {
      wx.navigateTo({
        url: '/pages/coupon/coupon-list/index'
      });
    }
  }
});
</script>

<template>
<wxs src="./index.wxs" module="handlePromotion" />

<wxs src="./utils.wxs" module="utils" />

<view class="cart-group [border-radius:8rpx] [&_.goods-wrap]:[margin-top:40rpx] [&_.goods-wrap]:[background-color:#fff] [&_.goods-wrap]:[border-radius:8rpx] [&_.goods-wrap]:[overflow:hidden] [&_.goods-wrap:first-of-type]:[margin-top:0] [&_.cart-store]:[height:96rpx] [&_.cart-store]:[background-color:#fff] [&_.cart-store]:[box-sizing:border-box] [&_.cart-store]:[display:flex] [&_.cart-store]:[align-items:center] [&_.cart-store]:[padding:0rpx_24rpx_0rpx_36rpx] [&_.cart-store_.cart-store__check]:[padding:28rpx_32rpx_28rpx_0rpx] [&_.cart-store__content]:[box-sizing:border-box] [&_.cart-store__content]:[flex:auto] [&_.cart-store__content]:[display:flex] [&_.cart-store__content]:[align-items:center] [&_.cart-store__content]:[justify-content:space-between] [&_.cart-store__content_.store-title]:[flex:auto] [&_.cart-store__content_.store-title]:[font-size:28rpx] [&_.cart-store__content_.store-title]:[line-height:40rpx] [&_.cart-store__content_.store-title]:[color:#333333] [&_.cart-store__content_.store-title]:[display:flex] [&_.cart-store__content_.store-title]:[align-items:center] [&_.cart-store__content_.store-title]:[font-weight:bold] [&_.cart-store__content_.store-title]:[overflow:hidden] [&_.cart-store__content_.store-title_.wr-store]:[font-size:32rpx] [&_.cart-store__content_.store-title_.store-name]:[overflow:hidden] [&_.cart-store__content_.store-title_.store-name]:[white-space:nowrap] [&_.cart-store__content_.store-title_.store-name]:[text-overflow:ellipsis] [&_.cart-store__content_.store-title_.store-name]:[margin-left:12rpx] [&_.cart-store__content_.get-coupon]:[width:112rpx] [&_.cart-store__content_.get-coupon]:[height:40rpx] [&_.cart-store__content_.get-coupon]:[border-radius:20rpx] [&_.cart-store__content_.get-coupon]:[background-color:#ffecf9] [&_.cart-store__content_.get-coupon]:[line-height:40rpx] [&_.cart-store__content_.get-coupon]:[text-align:center] [&_.cart-store__content_.get-coupon]:[font-size:26rpx] [&_.cart-store__content_.get-coupon]:[color:#fa4126] [&_.promotion-wrap]:[display:flex] [&_.promotion-wrap]:[justify-content:space-between] [&_.promotion-wrap]:[align-items:center] [&_.promotion-wrap]:[padding:0rpx_24rpx_32rpx_36rpx] [&_.promotion-wrap]:[background-color:#ffffff] [&_.promotion-wrap]:[font-size:24rpx] [&_.promotion-wrap]:[line-height:36rpx] [&_.promotion-wrap]:[color:#222427] [&_.promotion-wrap_.promotion-title]:[font-weight:bold] [&_.promotion-wrap_.promotion-title]:[flex:auto] [&_.promotion-wrap_.promotion-title]:[overflow:hidden] [&_.promotion-wrap_.promotion-title]:[margin-right:20rpx] [&_.promotion-wrap_.promotion-title]:[display:flex] [&_.promotion-wrap_.promotion-title]:[align-items:center] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[flex:none] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[font-weight:normal] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[display:inline-block] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[padding:0_8rpx] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[color:#ffffff] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[background:#fa4126] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[font-size:20rpx] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[height:32rpx] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[line-height:32rpx] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[margin-right:16rpx] [&_.promotion-wrap_.promotion-title_.promotion-icon]:[border-radius:16rpx] [&_.promotion-wrap_.promotion-title_.promotion-text]:[flex:auto] [&_.promotion-wrap_.promotion-title_.promotion-text]:[overflow:hidden] [&_.promotion-wrap_.promotion-title_.promotion-text]:[text-overflow:ellipsis] [&_.promotion-wrap_.promotion-title_.promotion-text]:[white-space:nowrap] [&_.promotion-wrap_.promotion-action]:[flex:none] [&_.promotion-wrap_.promotion-action]:[color:#333333] [&_.promotion-line-wrap]:[background-color:#fff] [&_.promotion-line-wrap]:[height:2rpx] [&_.promotion-line-wrap]:[display:flex] [&_.promotion-line-wrap]:[justify-content:flex-end] [&_.promotion-line-wrap_.promotion-line]:[width:684rpx] [&_.promotion-line-wrap_.promotion-line]:[height:2rpx] [&_.promotion-line-wrap_.promotion-line]:[background-color:#e6e6e6] [&_.goods-item-info]:[display:flex] [&_.goods-item-info]:[background-color:#fff] [&_.goods-item-info]:[align-items:flex-start] [&_.goods-item-info_.check-wrap]:[margin-top:56rpx] [&_.goods-item-info_.check-wrap]:[padding:20rpx_28rpx_20rpx_36rpx] [&_.goods-item-info_.check-wrap_.unCheck-icon]:[box-sizing:border-box] [&_.goods-item-info_.check-wrap_.unCheck-icon]:[width:36rpx] [&_.goods-item-info_.check-wrap_.unCheck-icon]:[height:36rpx] [&_.goods-item-info_.check-wrap_.unCheck-icon]:[border-radius:20rpx] [&_.goods-item-info_.check-wrap_.unCheck-icon]:[background:#f5f5f5] [&_.goods-item-info_.check-wrap_.unCheck-icon]:[border:2rpx_solid_#bbbbbb] [&_.goods-item-info_.goods-sku-info]:[padding:0rpx_32rpx_40rpx_0] [&_.goods-item-info_.goods-sku-info]:[flex-grow:1] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[position:absolute] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[color:#fff] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[font-size:24rpx] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[bottom:0rpx] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[background-color:rgba(0,_0,_0,_0.5)] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[width:100%] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[height:40rpx] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[line-height:40rpx] [&_.goods-item-info_.goods-sku-info_.stock-mask]:[text-align:center] [&_.goods-item-info_.goods-sku-info_.goods-stepper]:[position:absolute] [&_.goods-item-info_.goods-sku-info_.goods-stepper]:[right:0] [&_.goods-item-info_.goods-sku-info_.goods-stepper]:[bottom:8rpx] [&_.goods-item-info_.goods-sku-info_.goods-stepper_.stepper-tip]:[position:absolute] [&_.goods-item-info_.goods-sku-info_.goods-stepper_.stepper-tip]:[top:-36rpx] [&_.goods-item-info_.goods-sku-info_.goods-stepper_.stepper-tip]:[right:0] [&_.goods-item-info_.goods-sku-info_.goods-stepper_.stepper-tip]:[height:28rpx] [&_.goods-item-info_.goods-sku-info_.goods-stepper_.stepper-tip]:[color:#ff2525] [&_.goods-item-info_.goods-sku-info_.goods-stepper_.stepper-tip]:[font-size:20rpx] [&_.goods-item-info_.goods-sku-info_.goods-stepper_.stepper-tip]:[line-height:28rpx] [&_.shortage-line]:[width:662rpx] [&_.shortage-line]:[height:2rpx] [&_.shortage-line]:[background-color:#e6e6e6] [&_.shortage-line]:[margin:0_auto] [&_.shortage-goods-wrap]:[background-color:#fff] [&_.shortage-goods-wrap_.shortage-tip-title]:[height:72rpx] [&_.shortage-goods-wrap_.shortage-tip-title]:[line-height:72rpx] [&_.shortage-goods-wrap_.shortage-tip-title]:[padding-left:28rpx] [&_.shortage-goods-wrap_.shortage-tip-title]:[font-size:24rpx] [&_.shortage-goods-wrap_.shortage-tip-title]:[color:#999]">
  <view class="goods-wrap" wx:for="{{_storeGoods}}" wx:for-item="store" wx:for-index="si" wx:key="storeId">
    <view class="cart-store">
      <t-icon
        size="40rpx"
        color="{{store.isSelected ? '#FA4126' : '#BBBBBB'}}"
        name="{{store.isSelected ? 'check-circle-filled' : 'circle'}}"
        class="cart-store__check"
        bindtap="selectStore"
        data-store-index="{{si}}"
      />
      <view class="cart-store__content">
        <view class="store-title">
          <t-icon prefix="wr" size="40rpx" color="#333333" name="store" />
          <view class="store-name">{{store.storeName}}</view>
        </view>
        <view class="get-coupon" catch:tap="gotoCoupons">优惠券</view>
      </view>
    </view>
    <block wx:for="{{store.promotionGoodsList}}" wx:for-item="promotion" wx:for-index="promoindex" wx:key="promoindex">
      <view
        class="promotion-wrap"
        wx:if="{{handlePromotion.hasPromotion(promotion.promotionCode)}}"
        bindtap="gotoBuyMore"
        data-promotion="{{promotion}}"
        data-store-id="{{store.storeId}}"
      >
        <view class="promotion-title">
          <view class="promotion-icon">{{promotion.tag}}</view>
          <view class="promotion-text">{{promotion.description}}</view>
        </view>
        <view class="promotion-action action-btn [display:flex] [align-items:center] [&_.action-btn-arrow]:[font-size:20rpx] [&_.action-btn-arrow]:[margin-left:8rpx]" hover-class="action-btn--active [opacity:0.5]">
          <view class="promotion-action-label"> {{promotion.isNeedAddOnShop == 1 ? '去凑单' : '再逛逛'}} </view>
          <t-icon name="chevron-right" size="32rpx" color="#BBBBBB" />
        </view>
      </view>
      <view
        class="goods-item"
        wx:for="{{promotion.goodsPromotionList}}"
        wx:for-item="goods"
        wx:for-index="gi"
        wx:key="extKey"
      >
        <swipeout right-width="{{ 72 }}">
          <view class="goods-item-info">
            <view class="check-wrap" catchtap="selectGoods" data-goods="{{goods}}">
              <t-icon
                size="40rpx"
                color="{{goods.isSelected ? '#FA4126' : '#BBBBBB'}}"
                name="{{goods.isSelected ? 'check-circle-filled' : 'circle'}}"
                class="check"
              />
            </view>
            <view class="goods-sku-info [&_.no-storage-mask]:[position:absolute] [&_.no-storage-mask]:[color:#fff] [&_.no-storage-mask]:[bottom:0rpx] [&_.no-storage-mask]:[left:0rpx] [&_.no-storage-mask]:[background-color:rgba(0,_0,_0,_0.1)] [&_.no-storage-mask]:[height:192rpx] [&_.no-storage-mask]:[width:192rpx] [&_.no-storage-mask]:[border-radius:8rpx] [&_.no-storage-mask]:[display:flex] [&_.no-storage-mask]:[justify-content:center] [&_.no-storage-mask]:[align-items:center]">
              <goods-card
                layout="horizontal-wrap"
                thumb-width="{{thumbWidth}}"
                thumb-height="{{thumbHeight}}"
                centered="{{true}}"
                data="{{goods}}"
                data-goods="{{goods}}"
                catchspecs="specsTap"
                catchclick="goGoodsDetail"
              >
                <view slot="thumb-cover" class="stock-mask" wx:if="{{goods.shortageStock || goods.stockQuantity <= 3}}">
                  仅剩{{goods.stockQuantity}}件
                </view>
                <view slot="append-body" class="goods-stepper [&_.stepper]:[border:none] [&_.stepper]:[border-radius:0] [&_.stepper]:[height:auto] [&_.stepper]:[width:168rpx] [&_.stepper]:[overflow:visible] [&_.stepper_.stepper__minus]:[width:44rpx] [&_.stepper_.stepper__minus]:[height:44rpx] [&_.stepper_.stepper__minus]:[background-color:#f5f5f5] [&_.stepper_.stepper__plus]:[width:44rpx] [&_.stepper_.stepper__plus]:[height:44rpx] [&_.stepper_.stepper__plus]:[background-color:#f5f5f5] [&_.stepper_.stepper__minus--hover]:[background-color:#f5f5f5] [&_.stepper_.stepper__plus--hover]:[background-color:#f5f5f5] [&_.stepper_.stepper__minus_.wr-icon]:[font-size:24rpx] [&_.stepper_.stepper__plus_.wr-icon]:[font-size:24rpx] [&_.stepper_.stepper__minus]:[position:relative] [&_.stepper_.stepper__plus]:[position:relative] [&_.stepper_.stepper__input]:[width:72rpx] [&_.stepper_.stepper__input]:[height:44rpx] [&_.stepper_.stepper__input]:[background-color:#f5f5f5] [&_.stepper_.stepper__input]:[font-size:24rpx] [&_.stepper_.stepper__input]:[color:#222427] [&_.stepper_.stepper__input]:[font-weight:600] [&_.stepper_.stepper__input]:[border-left:none] [&_.stepper_.stepper__input]:[border-right:none] [&_.stepper_.stepper__input]:[min-height:40rpx] [&_.stepper_.stepper__input]:[margin:0_4rpx] [&_.stepper_.stepper__input]:[display:flex] [&_.stepper_.stepper__input]:[align-items:center]">
                  <view class="stepper-tip" wx:if="{{goods.shortageStock}}">库存不足</view>
                  <t-stepper
                    classname="stepper-info"
                    value="{{goods.quantity}}"
                    min="{{1}}"
                    max="{{999}}"
                    data-goods="{{goods}}"
                    data-gi="{{gi}}"
                    data-si="{{si}}"
                    catchchange="changeStepper"
                    catchblur="input"
                    catchoverlimit="overlimit"
                    theme="filled"
                  />
                </view>
              </goods-card>
            </view>
          </view>
          <view slot="right" class="swiper-right-del [height:calc(100%_-_40rpx)] [width:144rpx] [background-color:#fa4126] [font-size:28rpx] [color:white] [display:flex] [justify-content:center] [align-items:center]" bindtap="deleteGoods" data-goods="{{goods}}"> 删除 </view>
        </swipeout>
      </view>
      <view
        class="promotion-line-wrap"
        wx:if="{{handlePromotion.hasPromotion(promotion.promotionCode) && promoindex != (store.promotionGoodsList.length - 2)}}"
      >
        <view class="promotion-line" />
      </view>
    </block>
    <block wx:if="{{store.shortageGoodsList.length>0}}">
      <view
        class="goods-item"
        wx:for="{{store.shortageGoodsList}}"
        wx:for-item="goods"
        wx:for-index="gi"
        wx:key="extKey"
      >
        <swipeout right-width="{{ 72 }}">
          <view class="goods-item-info">
            <view class="check-wrap">
              <view class="unCheck-icon" />
            </view>
            <view class="goods-sku-info [&_.no-storage-mask]:[position:absolute] [&_.no-storage-mask]:[color:#fff] [&_.no-storage-mask]:[bottom:0rpx] [&_.no-storage-mask]:[left:0rpx] [&_.no-storage-mask]:[background-color:rgba(0,_0,_0,_0.1)] [&_.no-storage-mask]:[height:192rpx] [&_.no-storage-mask]:[width:192rpx] [&_.no-storage-mask]:[border-radius:8rpx] [&_.no-storage-mask]:[display:flex] [&_.no-storage-mask]:[justify-content:center] [&_.no-storage-mask]:[align-items:center]">
              <goods-card
                layout="horizontal-wrap"
                thumb-width="{{thumbWidth}}"
                thumb-height="{{thumbHeight}}"
                centered="{{true}}"
                data="{{goods}}"
                data-goods="{{goods}}"
                catchspecs="specsTap"
                catchclick="goGoodsDetail"
              >
                <view slot="thumb-cover" class="no-storage-mask [&_.no-storage-content]:[width:128rpx] [&_.no-storage-content]:[height:128rpx] [&_.no-storage-content]:[border-radius:64rpx] [&_.no-storage-content]:[background-color:rgba(0,_0,_0,_0.4)] [&_.no-storage-content]:[text-align:center] [&_.no-storage-content]:[line-height:128rpx] [&_.no-storage-content]:[font-size:28rpx]" wx:if="{{goods.stockQuantity <=0}}">
                  <view class="no-storage-content">无货</view>
                </view>
              </goods-card>
            </view>
          </view>
          <view slot="right" class="swiper-right-del [height:calc(100%_-_40rpx)] [width:144rpx] [background-color:#fa4126] [font-size:28rpx] [color:white] [display:flex] [justify-content:center] [align-items:center]" bindtap="deleteGoods" data-goods="{{goods}}"> 删除 </view>
        </swipeout>
      </view>
      <view
        class="promotion-line-wrap"
        wx:if="{{handlePromotion.hasPromotion(promotion.promotionCode) && promoindex != (store.promotionGoodsList.length - 2)}}"
      >
        <view class="promotion-line" />
      </view>
    </block>
  </view>
</view>
<specs-popup
  show="{{isShowSpecs}}"
  title="{{currentGoods.title || ''}}"
  price="{{currentGoods.price || ''}}"
  thumb="{{utils.imgCut(currentGoods.thumb, 180, 180)}}"
  specs="{{currentGoods.specs || []}}"
  zIndex="{{11001}}"
  bindclose="hideSpecsPopup"
/>

<t-toast id="t-toast" />
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-stepper": "tdesign-miniprogram/stepper/stepper",
    "swipeout": "/components/swipeout/index",
    "goods-card": "../../components/goods-card/index",
    "specs-popup": "../../components/specs-popup/index"
  }
}</json>
