<script lang="ts">
/* eslint-disable no-param-reassign */
/* eslint-disable no-nested-ternary */
import Toast from 'tdesign-miniprogram/toast/index';

Component({
  options: {
    multipleSlots: true,
    addGlobalClass: true,
  },

  properties: {
    src: {
      type: String,
    },
    title: String,
    show: {
      type: Boolean,
      value: false,
    },
    limitBuyInfo: {
      type: String,
      value: '',
    },
    isStock: {
      type: Boolean,
      value: true,
    },
    limitMaxCount: {
      type: Number,
      value: 999,
    },
    limitMinCount: {
      type: Number,
      value: 1,
    },
    skuList: {
      type: Array,
      value: [],
      observer(skuList) {
        if (skuList && skuList.length > 0) {
          if (this.initStatus) {
            this.initData();
          }
        }
      },
    },
    specList: {
      type: Array,
      value: [],
      observer(specList) {
        if (specList && specList.length > 0) {
          this.initData();
        }
      },
    },
    outOperateStatus: {
      type: Boolean,
      value: false,
    },
    hasAuth: {
      type: Boolean,
      value: false,
    },
    count: {
      type: Number,
      value: 1,
      observer(count) {
        this.setData({
          buyNum: count,
        });
      },
    },
  },

  initStatus: false,
  selectedSku: {},
  selectSpecObj: {},

  data: {
    buyNum: 1,
    isAllSelectedSku: false,
  },

  methods: {
    initData() {
      const { skuList } = this.properties;
      const { specList } = this.properties;
      specList.forEach((item) => {
        if (item.specValueList.length > 0) {
          item.specValueList.forEach((subItem) => {
            const obj = this.checkSkuStockQuantity(subItem.specValueId, skuList);
            subItem.hasStockObj = obj;
          });
        }
      });
      const selectedSku = {};
      specList.forEach((item) => {
        selectedSku[item.specId] = '';
      });
      this.setData({
        specList,
      });
      this.selectSpecObj = {};
      this.selectedSku = {};
      this.initStatus = true;
    },

    checkSkuStockQuantity(specValueId, skuList) {
      let hasStock = false;
      const array = [];
      skuList.forEach((item) => {
        (item.specInfo || []).forEach((subItem) => {
          if (subItem.specValueId === specValueId && item.quantity > 0) {
            const subArray = [];
            (item.specInfo || []).forEach((specItem) => {
              subArray.push(specItem.specValueId);
            });
            array.push(subArray);
            hasStock = true;
          }
        });
      });
      return {
        hasStock,
        specsArray: array,
      };
    },

    chooseSpecValueId(specValueId, specId) {
      const { selectSpecObj } = this;
      const { skuList, specList } = this.properties;
      if (selectSpecObj[specId]) {
        selectSpecObj[specId] = [];
        this.selectSpecObj = selectSpecObj;
      } else {
        selectSpecObj[specId] = [];
      }

      const itemAllSpecArray = [];
      const itemUnSelectArray = [];
      const itemSelectArray = [];
      specList.forEach((item) => {
        if (item.specId === specId) {
          const subSpecValueItem = item.specValueList.find((subItem) => subItem.specValueId === specValueId);
          let specSelectStatus = false;
          item.specValueList.forEach((n) => {
            itemAllSpecArray.push(n.hasStockObj.specsArray);
            if (n.isSelected) {
              specSelectStatus = true;
            }
            if (n.hasStockObj.hasStock) {
              itemSelectArray.push(n.specValueId);
            } else {
              itemUnSelectArray.push(n.specValueId);
            }
          });
          if (specSelectStatus) {
            selectSpecObj[specId] = this.flatten(subSpecValueItem?.hasStockObj.specsArray.concat(itemSelectArray));
          } else {
            const subSet = function (arr1, arr2) {
              const set2 = new Set(arr2);
              const subset = [];
              arr1.forEach((val) => {
                if (!set2.has(val)) {
                  subset.push(val);
                }
              });
              return subset;
            };
            selectSpecObj[specId] = subSet(this.flatten(itemAllSpecArray), this.flatten(itemUnSelectArray));
          }
        } else {
          // 未点击规格的逻辑
          const itemSelectArray = [];
          let specSelectStatus = false;
          item.specValueList.map(
            // 找到有库存的规格数组
            (n) => {
              itemSelectArray.push(n.hasStockObj.specsArray);
              if (n.isSelected) {
                specSelectStatus = true;
              }
              n.hasStockObj.hasStock = true;
              return n;
            },
          );
          if (specSelectStatus) {
            selectSpecObj[item.specId] = this.flatten(itemSelectArray);
          } else {
            delete selectSpecObj[item.specId];
          }
        }
        this.selectSpecObj = selectSpecObj;
      });
      const combatArray = Object.values(selectSpecObj);
      if (combatArray.length > 0) {
        const showArray = combatArray.reduce((x, y) => this.getIntersection(x, y));
        const lastResult = Array.from(new Set(showArray));
        specList.forEach((item) => {
          item.specValueList.forEach((subItem) => {
            if (lastResult.includes(subItem.specValueId)) {
              subItem.hasStockObj.hasStock = true;
            } else {
              subItem.hasStockObj.hasStock = false;
            }
          });
        });
      } else {
        specList.forEach((item) => {
          if (item.specValueList.length > 0) {
            item.specValueList.forEach((subItem) => {
              const obj = this.checkSkuStockQuantity(subItem.specValueId, skuList);
              subItem.hasStockObj = obj;
            });
          }
        });
      }
      this.setData({
        specList,
      });
    },

    flatten(input) {
      const stack = [...input];
      const res = [];
      while (stack.length) {
        const next = stack.pop();
        if (Array.isArray(next)) {
          stack.push(...next);
        } else {
          res.push(next);
        }
      }
      return res.reverse();
    },

    getIntersection(array, nextArray) {
      return array.filter((item) => nextArray.includes(item));
    },

    toChooseItem(e) {
      const { isStock } = this.properties;
      if (!isStock) return;
      const { id } = e.currentTarget.dataset;
      const specId = e.currentTarget.dataset.specid;
      const hasStock = e.currentTarget.dataset.hasstock;
      if (!hasStock) {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '该规格已售罄',
          icon: '',
          duration: 1000,
        });
        return;
      }

      let { selectedSku } = this;
      const { specList } = this.properties;
      selectedSku =
        selectedSku[specId] === id ? { ...this.selectedSku, [specId]: '' } : { ...this.selectedSku, [specId]: id };
      specList.forEach((item) => {
        item.specValueList.forEach((valuesItem) => {
          if (item.specId === specId) {
            valuesItem.isSelected = valuesItem.specValueId === selectedSku[specId];
          }
        });
      });
      this.chooseSpecValueId(id, specId);
      const isAllSelectedSku = this.isAllSelected(specList, selectedSku);
      if (!isAllSelectedSku) {
        this.setData({
          selectSkuSellsPrice: 0,
          selectSkuImg: '',
        });
      }
      this.setData({
        specList,
        isAllSelectedSku,
      });
      this.selectedSku = selectedSku;
      this.triggerEvent('change', {
        specList,
        selectedSku,
        isAllSelectedSku,
      });
    },

    // 判断是否所有的sku都已经选中
    isAllSelected(skuTree, selectedSku) {
      const selected = Object.keys(selectedSku).filter((skuKeyStr) => selectedSku[skuKeyStr] !== '');
      return skuTree.length === selected.length;
    },

    handlePopupHide() {
      this.triggerEvent('closeSpecsPopup', {
        show: false,
      });
    },

    specsConfirm() {
      const { isStock } = this.properties;
      if (!isStock) return;
      this.triggerEvent('specsConfirm');
    },

    addCart() {
      const { isStock } = this.properties;
      if (!isStock) return;
      this.triggerEvent('addCart');
    },

    buyNow() {
      const { isAllSelectedSku } = this.data;
      const { isStock } = this.properties;
      if (!isStock) return;
      this.triggerEvent('buyNow', {
        isAllSelectedSku,
      });
    },

    // 总处理
    setBuyNum(buyNum) {
      this.setData({
        buyNum,
      });
      this.triggerEvent('changeNum', {
        buyNum,
      });
    },

    handleBuyNumChange(e) {
      const { value } = e.detail;
      this.setData({
        buyNum: value,
      });
    },
  },
});
</script>

<template>
<t-popup visible="{{show}}" placement="bottom" bind:visible-change="handlePopupHide">
  <view class="popup-container [background-color:#ffffff] [position:relative] [z-index:100] [border-radius:16rpx_16rpx_0_0] [padding-bottom:calc(env(safe-area-inset-bottom)_+_20rpx)] [&_.popup-close]:[position:absolute] [&_.popup-close]:[right:30rpx] [&_.popup-close]:[top:30rpx] [&_.popup-close]:[z-index:9] [&_.popup-close]:[color:#999999] [&_.single-confirm-btn]:[border-radius:48rpx] [&_.single-confirm-btn]:[color:#ffffff] [&_.single-confirm-btn]:[margin:0_32rpx] [&_.single-confirm-btn]:[font-size:32rpx] [&_.single-confirm-btn]:[height:80rpx] [&_.single-confirm-btn]:[text-align:center] [&_.single-confirm-btn]:[line-height:88rpx] [&_.single-confirm-btn]:[background-color:#fa4126] [&_.single-confirm-btn_.disabled]:[font-size:32rpx] [&_.single-confirm-btn_.disabled]:[color:#fff] [&_.single-confirm-btn_.disabled]:[background-color:#dddddd]">
    <view class="popup-close" bindtap="handlePopupHide">
      <t-icon name="close" size="36rpx" />
    </view>
    <view class="popup-sku-header [display:flex] [padding:30rpx_28rpx_0_30rpx] [&_.popup-sku-header__img]:[width:176rpx] [&_.popup-sku-header__img]:[height:176rpx] [&_.popup-sku-header__img]:[border-radius:8rpx] [&_.popup-sku-header__img]:[background:#d8d8d8] [&_.popup-sku-header__img]:[margin-right:24rpx] [&_.popup-sku-header__goods-info]:[position:relative] [&_.popup-sku-header__goods-info]:[width:500rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[font-size:28rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[line-height:40rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[display:-webkit-box] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[-webkit-line-clamp:2] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[-webkit-box-orient:vertical] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[white-space:normal] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[overflow:hidden] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[width:430rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:[text-overflow:ellipsis] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:[display:flex] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:[color:#333333] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:[font-size:26rpx] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:[line-height:36rpx] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec_.popup-sku__selected-item]:[margin-right:10rpx]">
      <t-image t-class="popup-sku-header__img" src="{{src}}" />
      <view class="popup-sku-header__goods-info">
        <view class="popup-sku__goods-name">{{title}}</view>
        <view class="goods-price-container">
          <slot name="goods-price" />
        </view>
        <!-- 已选规格 -->
        <view class="popup-sku__selected-spec">
          <view>选择：</view>
          <view wx:for="{{specList}}" wx:key="specId">
            <view
              class="popup-sku__selected-item"
              wx:for="{{item.specValueList}}"
              wx:for-item="selectedItem"
              wx:if="{{selectedItem.isSelected}}"
              wx:key="specValueId"
            >
              {{selectedItem.specValue}}
            </view>
          </view>
        </view>
      </view>
    </view>
    <view class="popup-sku-body [margin:0_30rpx_40rpx] [max-height:600rpx] [overflow-y:scroll] [-webkit-overflow-scrolling:touch] [&_.popup-sku-group-container_.popup-sku-row]:[padding:32rpx_0] [&_.popup-sku-group-container_.popup-sku-row]:[border-bottom:1rpx_solid_#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__title]:[font-size:26rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__title]:[color:#333] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[font-size:24rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[color:#333] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[min-width:128rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[height:56rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[background-color:#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[border-radius:8rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[border:2rpx_solid_#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[margin:19rpx_26rpx_0_0] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[padding:0_16rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[display:inline-flex] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[align-items:center] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[justify-content:center] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item_.popup-sku-row__item--active]:[border:2rpx_solid_#fa4126] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item_.popup-sku-row__item--active]:[color:#fa4126] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item_.popup-sku-row__item--active]:[background:rgba(255,_95,_21,_0.04)] [&_.popup-sku-group-container_.popup-sku-row_.disabled-sku-selected]:[background:#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.disabled-sku-selected]:[color:#cccccc] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:[display:flex] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:[align-items:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:[justify-content:space-between] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:[margin:40rpx_0] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title]:[display:flex] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title]:[font-size:26rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title]:[color:#333] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title_.limit-text]:[margin-left:10rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title_.limit-text]:[color:#999999] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper]:[display:flex] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper]:[flex-flow:row_nowrap] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper]:[align-items:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper]:[font-size:28px] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper]:[height:48rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper]:[line-height:62rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-btn]:[position:relative] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-btn]:[height:100%] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-btn]:[text-align:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-btn]:[background-color:#f5f5f5] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-btn]:[border-radius:4rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[position:relative] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[height:100%] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[text-align:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[background-color:#f5f5f5] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[border-radius:4rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[color:#282828] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[display:flex] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[max-width:76rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[align-items:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap]:[justify-content:space-between] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap_.input-num]:[height:100%] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap_.input-num]:[width:auto] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap_.input-num]:[font-weight:600] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-num-wrap_.input-num]:[font-size:30rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.input-btn]:[width:48rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__minus]:[margin-right:4rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__minus]:[border-radius:4rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__minus]:[color:#9a979b] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__minus]:[display:flex] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__minus]:[align-items:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__minus]:[justify-content:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__plus]:[margin-left:4rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__plus]:[border-radius:4rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__plus]:[color:#9a979b] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__plus]:[display:flex] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__plus]:[align-items:center] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-stepper_.popup-stepper__plus]:[justify-content:center]">
      <view class="popup-sku-group-container">
        <view class="popup-sku-row" wx:for="{{specList}}" wx:key="specId">
          <view class="popup-sku-row__title">{{item.title}}</view>
          <block
            wx:for="{{item.specValueList}}"
            wx:for-item="valuesItem"
            wx:for-index="valuesIndex"
            wx:key="specValueId"
          >
            <view
              class="popup-sku-row__item {{valuesItem.isSelected ? 'popup-sku-row__item--active' : ''}} {{!valuesItem.hasStockObj.hasStock || !isStock ? 'disabled-sku-selected' : ''}}"
              data-specid="{{item.specId}}"
              data-id="{{valuesItem.specValueId}}"
              data-val="{{valuesItem.specValue}}"
              data-hasStock="{{valuesItem.hasStockObj.hasStock}}"
              bindtap="toChooseItem"
            >
              {{valuesItem.specValue}}
            </view>
          </block>
        </view>
      </view>
      <view class="popup-sku-stepper-stock">
        <view class="popup-sku-stepper-container">
          <view class="popup-sku__stepper-title">
            购买数量
            <view class="limit-text" wx:if="{{limitBuyInfo}}"> ({{limitBuyInfo}}) </view>
          </view>
          <t-stepper value="{{buyNum}}" min="{{1}}" max="{{2}}" theme="filled" bind:change="handleBuyNumChange" />
        </view>
      </view>
    </view>
    <view wx:if="{{outOperateStatus}}" class="single-confirm-btn {{!isStock ? 'disabled' : ''}}" bindtap="specsConfirm">
      确定
    </view>
    <view
      class="popup-sku-actions flex flex-between {{!isStock ? 'popup-sku-disabled' : ''}} [font-size:32rpx] [height:80rpx] [text-align:center] [line-height:80rpx] [padding:0_20rpx] [&_.sku-operate]:[height:80rpx] [&_.sku-operate]:[width:50%] [&_.sku-operate]:[color:#fff] [&_.sku-operate]:[border-radius:48rpx] [&_.sku-operate_.sku-operate-addCart]:[background-color:#ffece9] [&_.sku-operate_.sku-operate-addCart]:[color:#fa4126] [&_.sku-operate_.sku-operate-addCart]:[border-radius:48rpx_0_0_48rpx] [&_.sku-operate_.sku-operate-addCart_.disabled]:[background:rgb(221,_221,_221)] [&_.sku-operate_.sku-operate-addCart_.disabled]:[color:#fff] [&_.sku-operate_.sku-operate-buyNow]:[background-color:#fa4126] [&_.sku-operate_.sku-operate-buyNow]:[border-radius:0_48rpx_48rpx_0] [&_.sku-operate_.sku-operate-buyNow_.disabled]:[color:#fff] [&_.sku-operate_.sku-operate-buyNow_.disabled]:[background:rgb(198,_198,_198)] [&_.sku-operate_.selected-sku-btn]:[width:100%]"
      wx:if="{{!outOperateStatus}}"
    >
      <view class="sku-operate">
        <view class="selected-sku-btn sku-operate-addCart {{!isStock ? 'disabled' : ''}}" bindtap="addCart">
          加入购物车
        </view>
      </view>
      <view class="sku-operate">
        <view class="selected-sku-btn sku-operate-buyNow  {{!isStock ? 'disabled' : ''}}" bindtap="buyNow">
          立即购买
        </view>
      </view>
    </view>
    <slot name="bottomSlot" />
  </view>
</t-popup>
<t-toast id="t-toast" />
</template>

<json>
{
  "component": true,
  "usingComponents": {
    "t-popup": "tdesign-miniprogram/popup/popup",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-image": "/components/webp-image/index",
    "t-stepper": "tdesign-miniprogram/stepper/stepper",
    "t-toast": "tdesign-miniprogram/toast/toast"
  }
}</json>
