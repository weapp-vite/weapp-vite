<script lang="ts">
Component({
  options: {
    addGlobalClass: true,
  },

  properties: {
    id: {
      type: String,
      value: '',
      observer(id) {
        this.genIndependentID(id);
        if (this.properties.thresholds?.length) {
          this.createIntersectionObserverHandle();
        }
      },
    },
    data: {
      type: Object,
      observer(data) {
        if (!data) {
          return;
        }
        let isValidityLinePrice = true;
        if (data.originPrice && data.price && data.originPrice < data.price) {
          isValidityLinePrice = false;
        }
        this.setData({ goods: data, isValidityLinePrice });
      },
    },
    currency: {
      type: String,
      value: '¥',
    },

    thresholds: {
      type: Array,
      value: [],
      observer(thresholds) {
        if (thresholds && thresholds.length) {
          this.createIntersectionObserverHandle();
        } else {
          this.clearIntersectionObserverHandle();
        }
      },
    },
  },

  data: {
    independentID: '',
    goods: { id: '' },
    isValidityLinePrice: false,
  },

  lifetimes: {
    ready() {
      this.init();
    },
    detached() {
      this.clear();
    },
  },

  pageLifeTimes: {},

  methods: {
    clickHandle() {
      this.triggerEvent('click', { goods: this.data.goods });
    },

    clickThumbHandle() {
      this.triggerEvent('thumb', { goods: this.data.goods });
    },

    addCartHandle(e) {
      const { id } = e.currentTarget;
      const { id: cardID } = e.currentTarget.dataset;
      this.triggerEvent('add-cart', {
        ...e.detail,
        id,
        cardID,
        goods: this.data.goods,
      });
    },

    genIndependentID(id) {
      let independentID;
      if (id) {
        independentID = id;
      } else {
        independentID = `goods-card-${~~(Math.random() * 10 ** 8)}`;
      }
      this.setData({ independentID });
    },

    init() {
      const { thresholds, id } = this.properties;
      this.genIndependentID(id);
      if (thresholds && thresholds.length) {
        this.createIntersectionObserverHandle();
      }
    },

    clear() {
      this.clearIntersectionObserverHandle();
    },

    intersectionObserverContext: null,

    createIntersectionObserverHandle() {
      if (this.intersectionObserverContext || !this.data.independentID) {
        return;
      }
      this.intersectionObserverContext = this.createIntersectionObserver({
        thresholds: this.properties.thresholds,
      }).relativeToViewport();

      this.intersectionObserverContext.observe(
        `#${this.data.independentID}`,
        (res) => {
          this.intersectionObserverCB(res);
        },
      );
    },

    intersectionObserverCB() {
      this.triggerEvent('ob', {
        goods: this.data.goods,
        context: this.intersectionObserverContext,
      });
    },

    clearIntersectionObserverHandle() {
      if (this.intersectionObserverContext) {
        try {
          this.intersectionObserverContext.disconnect();
        } catch (e) {}
        this.intersectionObserverContext = null;
      }
    },
  },
});
</script>

<template>
<view
  id="{{independentID}}"
  class="goods-card [box-sizing:border-box] [font-size:24rpx] [border-radius:0_0_16rpx_16rpx] [border-bottom:none]"
  bind:tap="clickHandle"
  data-goods="{{ goods }}"
>
	<view class="goods-card__main [position:relative] [display:flex] [line-height:1] [padding:0] [background:transparent] [width:342rpx] [border-radius:0_0_16rpx_16rpx] [align-items:center] [justify-content:center] [margin-bottom:16rpx] [flex-direction:column]">
		<view class="goods-card__thumb [flex-shrink:0] [position:relative] [width:340rpx] [height:340rpx] [&:empty]:[display:none] [&:empty]:[margin:0]" bind:tap="clickThumbHandle">
			<t-image
			  wx:if="{{ !!goods.thumb }}"
			  t-class="goods-card__img [display:block] [width:100%] [height:100%] [border-radius:16rpx_16rpx_0_0] [overflow:hidden]"
			  src="{{ goods.thumb }}"
			  mode="aspectFill"
			  lazy-load
			/>
		</view>
		<view class="goods-card__body [display:flex] [flex:1_1_auto] [background:#fff] [border-radius:0_0_16rpx_16rpx] [padding:16rpx_24rpx_18rpx] [flex-direction:column]">
			<view class="goods-card__upper [display:flex] [flex-direction:column] [overflow:hidden] [flex:1_1_auto]">
				<view wx:if="{{ goods.title }}" class="goods-card__title [flex-shrink:0] [font-size:28rpx] [color:#333] [font-weight:400] [display:-webkit-box] [height:72rpx] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow:hidden] [word-break:break-word] [line-height:36rpx]">
					{{ goods.title }}
				</view>
				<view wx:if="{{ goods.tags && !!goods.tags.length }}" class="goods-card__tags [display:flex] [flex-direction:row] [flex-wrap:wrap] [margin:8rpx_0_0_0]">
					<view
					  wx:for="{{ goods.tags }}"
					  wx:key="index"
					  wx:for-item="tag"
					  class="goods-card__tag [color:#fa4126] [background:transparent] [font-size:20rpx] [border:1rpx_solid_#fa4126] [padding:0_8rpx] [border-radius:16rpx] [line-height:30rpx] [margin:0_8rpx_8rpx_0] [display:block] [overflow:hidden] [white-space:nowrap] [word-break:keep-all] [text-overflow:ellipsis]"
					  data-index="{{index}}"
					>
						{{tag}}
					</view>
				</view>
			</view>
			<view class="goods-card__down [display:flex] [position:relative] [flex-direction:row] [justify-content:flex-start] [align-items:baseline] [line-height:32rpx] [margin:8rpx_0_0_0]">
				<price
				  wx:if="{{ goods.price }}"
				  wr-class="spec-for-price [font-size:36rpx] [white-space:nowrap] [font-weight:700] [order:1] [color:#fa4126] [margin:0]"
				  symbol-class="spec-for-symbol [font-size:24rpx]"
				  symbol="{{currency}}"
				  price="{{goods.price}}"
				/>
				<price
				  wx:if="{{ goods.originPrice && isValidityLinePrice }}"
				  wr-class="goods-card__origin-price [white-space:nowrap] [font-weight:700] [order:2] [color:#bbbbbb] [font-size:24rpx] [margin:0_0_0_8rpx]"
				  symbol="{{currency}}"
				  price="{{goods.originPrice}}"
				  type="delthrough"
				/>
				<t-icon
				  class="goods-card__add-cart [order:3] [margin:auto_0_0_auto] [position:absolute] [bottom:0] [right:0]"
				  prefix="wr"
				  name="cartAdd"
				  id="{{independentID}}-cart"
				  data-id="{{independentID}}"
				  catchtap="addCartHandle"
				  size="48rpx"
				  color="#FA550F"
				/>
			</view>
		</view>
	</view>
</view>

</template>

<json>
{
    "component": true,
    "usingComponents": {
        "price": "/components/price/index",
        "t-icon": "tdesign-miniprogram/icon/icon",
        "t-image": "/components/webp-image/index"
    }
}</json>
