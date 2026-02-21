<script setup lang="ts">
defineOptions({
  options: {
    multipleSlots: true,
    // 在组件定义时的选项中启用多slot支持
    addGlobalClass: true
  },
  intersectionObserverContext: null,
  externalClasses: ['card-class', 'title-class', 'desc-class', 'num-class', 'thumb-class', 'specs-class', 'price-class', 'origin-price-class', 'price-prefix-class'],
  relations: {
    '../order-card/index': {
      type: 'ancestor',
      linked(target) {
        this.parent = target;
      }
    }
  },
  properties: {
    hidden: {
      // 设置为null代表不做类型转换
      type: null,
      value: false,
      observer(hidden) {
        // null就是代表没有设置，没有设置的话不setData，防止祖先组件触发的setHidden操作被覆盖
        if (hidden !== null) {
          this.setHidden(!!hidden);
        }
      }
    },
    id: {
      type: String,
      // `goods-card-88888888`
      // 不能在这里写生成逻辑，如果在这里写，那么假设有多个goods-list时，他们将共享这个值
      value: '',
      observer: id => {
        this.genIndependentID(id);
        if (this.properties.thresholds?.length) {
          this.createIntersectionObserverHandle();
        }
      }
    },
    data: {
      type: Object,
      observer(goods) {
        // 有ID的商品才渲染
        if (!goods) {
          return;
        }

        /** 划线价是否有效 */
        let isValidityLinePrice = true;
        // 判断一次划线价格是否合理
        if (goods.originPrice && goods.price && goods.originPrice < goods.price) {
          isValidityLinePrice = false;
        }

        // 敲定换行数量默认值
        if (goods.lineClamp === undefined || goods.lineClamp <= 0) {
          // tag数组长度 大于0 且 可见
          // 指定换行为1行
          if ((goods.tags?.length || 0) > 0 && !goods.hideKey?.tags) {
            goods.lineClamp = 1;
          } else {
            goods.lineClamp = 2;
          }
        }
        this.setData({
          goods,
          isValidityLinePrice
        });
      }
    },
    layout: {
      type: String,
      value: 'horizontal'
    },
    thumbMode: {
      type: String,
      value: 'aspectFill'
    },
    thumbWidth: Number,
    thumbHeight: Number,
    priceFill: {
      type: Boolean,
      value: true
    },
    currency: {
      type: String,
      value: '¥'
    },
    lazyLoad: {
      type: Boolean,
      value: false
    },
    centered: {
      type: Boolean,
      value: false
    },
    showCart: {
      type: Boolean,
      value: false
    },
    pricePrefix: {
      type: String,
      value: ''
    },
    cartSize: {
      type: Number,
      value: 48
    },
    cartColor: {
      type: String,
      value: '#FA550F'
    },
    /** 元素可见监控阈值, 数组长度大于0就创建 */
    thresholds: {
      type: Array,
      value: [],
      observer(current) {
        if (current && current.length) {
          this.createIntersectionObserverHandle();
        } else {
          this.clearIntersectionObserverHandle();
        }
      }
    },
    specsIconClassPrefix: {
      type: String,
      value: 'wr'
    },
    specsIcon: {
      type: String,
      value: 'expand_more'
    },
    addCartIconClassPrefix: {
      type: String,
      value: 'wr'
    },
    addCartIcon: {
      type: String,
      value: 'cart'
    }
  },
  data() {
    return {
      hiddenInData: false,
      independentID: '',
      goods: {
        id: ''
      },
      /** 保证划线价格不小于原价，否则不渲染划线价 */
      isValidityLinePrice: false
    };
  },
  lifetimes: {
    ready() {
      this.init();
    },
    detached() {
      this.clear();
    }
  },
  methods: {
    clickHandle() {
      this.triggerEvent('click', {
        goods: this.data.goods
      });
    },
    clickThumbHandle() {
      this.triggerEvent('thumb', {
        goods: this.data.goods
      });
    },
    clickTagHandle(evt) {
      const {
        index
      } = evt.currentTarget.dataset;
      this.triggerEvent('tag', {
        goods: this.data.goods,
        index
      });
    },
    // 加入购物车
    addCartHandle(e) {
      const {
        id
      } = e.currentTarget;
      const {
        id: cardID
      } = e.currentTarget.dataset;
      this.triggerEvent('add-cart', {
        ...e.detail,
        id,
        cardID,
        goods: this.data.goods
      });
    },
    genIndependentID(id, cb) {
      let independentID;
      if (id) {
        independentID = id;
      } else {
        // `goods-card-88888888`
        independentID = `goods-card-${~~(Math.random() * 10 ** 8)}`;
      }
      this.setData({
        independentID
      }, cb);
    },
    init() {
      const {
        thresholds,
        id,
        hidden
      } = this.properties;
      if (hidden !== null) {
        this.setHidden(!!hidden);
      }
      this.genIndependentID(id || '', () => {
        if (thresholds && thresholds.length) {
          this.createIntersectionObserverHandle();
        }
      });
    },
    clear() {
      this.clearIntersectionObserverHandle();
    },
    setHidden(hidden) {
      this.setData({
        hiddenInData: !!hidden
      });
    },
    createIntersectionObserverHandle() {
      if (this.intersectionObserverContext || !this.data.independentID) {
        return;
      }
      this.intersectionObserverContext = wx.createIntersectionObserver(this, {
        thresholds: this.properties.thresholds
      }).relativeToViewport();
      this.intersectionObserverContext.observe(`#${this.data.independentID}`, res => {
        this.intersectionObserverCB(res);
      });
    },
    intersectionObserverCB(ob) {
      this.triggerEvent('ob', {
        goods: this.data.goods,
        context: this.intersectionObserverContext,
        ob
      });
    },
    clearIntersectionObserverHandle() {
      if (this.intersectionObserverContext) {
        try {
          this.intersectionObserverContext.disconnect();
        } catch (e) {}
        this.intersectionObserverContext = null;
      }
    }
  }
});
</script>

<template>
<view
 id="{{independentID}}"
 class="wr-goods-card card-class {{ layout }} {{ centered ? 'center' : ''}} [box-sizing:border-box] [font-size:24rpx] [&_.center_.wr-goods-card__main]:[align-items:center] [&_.center_.wr-goods-card__main]:[justify-content:center] [&_.horizontal-wrap_.wr-goods-card__thumb]:[width:192rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:[height:192rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:[border-radius:8rpx] [&_.horizontal-wrap_.wr-goods-card__thumb]:[overflow:hidden] [&_.horizontal-wrap_.wr-goods-card__body]:[flex-direction:column] [&_.horizontal-wrap_.wr-goods-card__short_content]:[flex-direction:row] [&_.horizontal-wrap_.wr-goods-card__short_content]:[align-items:center] [&_.horizontal-wrap_.wr-goods-card__short_content]:[margin:16rpx_0_0_0] [&_.horizontal-wrap_.wr-goods-card__num]:[margin:0_0_0_auto] [&_.vertical_.wr-goods-card__main]:[padding:0_0_22rpx_0] [&_.vertical_.wr-goods-card__main]:[flex-direction:column] [&_.vertical_.wr-goods-card__thumb]:[width:340rpx] [&_.vertical_.wr-goods-card__thumb]:[height:340rpx] [&_.vertical_.wr-goods-card__body]:[margin:20rpx_20rpx_0_20rpx] [&_.vertical_.wr-goods-card__body]:[flex-direction:column] [&_.vertical_.wr-goods-card__long_content]:[overflow:hidden] [&_.vertical_.wr-goods-card__title]:[line-height:36rpx] [&_.vertical_.wr-goods-card__short_content]:[margin:20rpx_0_0_0] [&_.vertical_.wr-goods-card__price]:[order:2] [&_.vertical_.wr-goods-card__price]:[color:#fa4126] [&_.vertical_.wr-goods-card__price]:[margin:20rpx_0_0_0] [&_.vertical_.wr-goods-card__origin-price]:[order:1] [&_.vertical_.wr-goods-card__add-cart]:[position:absolute] [&_.vertical_.wr-goods-card__add-cart]:[bottom:20rpx] [&_.vertical_.wr-goods-card__add-cart]:[right:20rpx]"
 bind:tap="clickHandle"
 data-goods="{{ goods }}"
 hidden="{{hiddenInData}}"
>
	<view class="wr-goods-card__main [position:relative] [display:flex] [line-height:1] [flex-direction:row] [background:transparent] [padding:16rpx_0rpx]">
		<view class="wr-goods-card__thumb thumb-class [flex-shrink:0] [position:relative] [width:176rpx] [height:176rpx] [&:empty]:[display:none] [&:empty]:[margin:0]" bind:tap="clickThumbHandle">
			<!-- data-src 是方便加购动画读取图片用的 -->
			<t-image
			 t-class="wr-goods-card__thumb-com [width:176rpx] [height:176rpx] [border-radius:8rpx] [overflow:hidden]"
			 wx:if="{{ !!goods.thumb && !goods.hideKey.thumb }}"
			 src="{{ goods.thumb }}"
			 mode="{{ thumbMode }}"
			 lazy-load="{{ lazyLoad }}"
			/>
			<slot name="thumb-cover" />
		</view>

		<view class="wr-goods-card__body [display:flex] [margin:0_0_0_16rpx] [flex-direction:row] [flex:1_1_auto] [min-height:176rpx]">
			<view class="wr-goods-card__long_content [display:flex] [flex-direction:column] [overflow:hidden] [flex:1_1_auto] [&_.goods_tips]:[width:100%] [&_.goods_tips]:[margin-top:16rpx] [&_.goods_tips]:[text-align:right] [&_.goods_tips]:[color:#fa4126] [&_.goods_tips]:[font-size:24rpx] [&_.goods_tips]:[line-height:32rpx] [&_.goods_tips]:[font-weight:bold]">
				<view wx:if="{{ goods.title && !goods.hideKey.title }}" class="wr-goods-card__title title-class [flex-shrink:0] [font-size:28rpx] [color:#333] [line-height:40rpx] [font-weight:400] [display:-webkit-box] [-webkit-box-orient:vertical] [overflow:hidden] [word-break:break-word]" style="-webkit-line-clamp: {{ goods.lineClamp }};">
					<slot name="before-title" />
					{{ goods.title }}
				</view>
				<slot name="after-title" />
				<view wx:if="{{ goods.desc && !goods.hideKey.desc }}" class="wr-goods-card__desc desc-class [font-size:24rpx] [color:#f5f5f5] [line-height:40rpx] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow:hidden]">{{ goods.desc }}</view>
				<slot name="after-desc" />
				<view wx:if="{{ goods.specs && goods.specs.length > 0 && !goods.hideKey.specs }}" class="wr-goods-card__specs__desc specs-class [font-size:24rpx] [height:32rpx] [line-height:32rpx] [color:#999999] [margin:8rpx_0] [display:flex] [align-self:flex-start] [flex-direction:row]" bind:tap="clickSpecsHandle">
					<view class="wr-goods-card__specs__desc-text [height:100%] [max-width:380rpx] [word-break:break-all] [overflow:hidden] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:1]">{{ goods.specs }}</view>
				</view>
				<view class="goods_tips" wx:if="{{goods.stockQuantity !== 0 && goods.quantity >= goods.stockQuantity}}">库存不足</view>
			</view>

			<view class="wr-goods-card__short_content [display:flex] [flex-direction:column] [justify-content:flex-start] [align-items:flex-end] [margin:0_0_0_46rpx] [&_.no_storage]:[display:flex] [&_.no_storage]:[align-items:center] [&_.no_storage]:[justify-content:space-between] [&_.no_storage]:[height:40rpx] [&_.no_storage]:[color:#333] [&_.no_storage]:[font-size:24rpx] [&_.no_storage]:[line-height:32rpx] [&_.no_storage]:[width:100%]">
				<block wx:if="{{goods.stockQuantity !== 0}}">
					<view wx:if="{{ pricePrefix }}" class="wr-goods-card__price__prefix price-prefix-class [order:0] [color:#666] [margin:0]">{{ pricePrefix }}</view>
					<slot name="price-prefix" />
					<view wx:if="{{ goods.price && !goods.hideKey.price }}" class="wr-goods-card__price [white-space:nowrap] [font-weight:bold] [order:1] [color:#fa4126] [font-size:36rpx] [margin:0] [line-height:48rpx]">
						<price
						 wr-class="price-class"
						 symbol="{{currency}}"
						 price="{{goods.price}}"
						 fill="{{priceFill}}"
						 decimalSmaller
						/>
					</view>
					<view wx:if="{{ goods.originPrice && !goods.hideKey.originPrice && isValidityLinePrice }}" class="wr-goods-card__origin-price [white-space:nowrap] [font-weight:normal] [order:2] [color:#aaaaaa] [font-size:24rpx] [margin:0]">
						<price
						 wr-class="origin-price-class"
						 symbol="{{currency}}"
						 price="{{goods.originPrice}}"
						 fill="{{priceFill}}"
						/>
					</view>
					<slot name="origin-price" />
					<view wx:if="{{goods.num && !goods.hideKey.num}}" class="wr-goods-card__num num-class [white-space:nowrap] [order:4] [font-size:24rpx] [color:#999] [margin:20rpx_0_0_auto]">
						<text class="wr-goods-card__num__prefix [color:inherit]">x </text>
						{{ goods.num }}
					</view>
				</block>
				<block wx:else>
					<view class="no_storage [&_.no_storage__right]:[width:80rpx] [&_.no_storage__right]:[height:40rpx] [&_.no_storage__right]:[border-radius:20rpx] [&_.no_storage__right]:[border:2rpx_solid_#fa4126] [&_.no_storage__right]:[line-height:40rpx] [&_.no_storage__right]:[text-align:center] [&_.no_storage__right]:[color:#fa4126]">
						<view>请重新选择商品规格</view>
						<view class="no_storage__right">重选</view>
					</view>
				</block>

			</view>
			<slot name="append-body" />
		</view>
		<slot name="footer" />
	</view>
	<slot name="append-card" />
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {
    "price": "/components/price/index",
    "t-image": "/components/webp-image/index",
    "t-icon": "tdesign-miniprogram/icon/icon"
  }
}</json>
