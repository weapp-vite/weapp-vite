<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class'],
  properties: {
    goodsList: {
      type: Array,
      value: []
    },
    id: {
      type: String,
      value: '',
      observer: id => {
        this.genIndependentID(id);
      }
    },
    thresholds: {
      type: Array,
      value: []
    }
  },
  data() {
    return {
      independentID: ''
    };
  },
  lifetimes: {
    ready() {
      this.init();
    }
  },
  methods: {
    onClickGoods(e) {
      const {
        index
      } = e.currentTarget.dataset;
      this.triggerEvent('click', {
        ...e.detail,
        index
      });
    },
    onAddCart(e) {
      const {
        index
      } = e.currentTarget.dataset;
      this.triggerEvent('addcart', {
        ...e.detail,
        index
      });
    },
    onClickGoodsThumb(e) {
      const {
        index
      } = e.currentTarget.dataset;
      this.triggerEvent('thumb', {
        ...e.detail,
        index
      });
    },
    init() {
      this.genIndependentID(this.id || '');
    },
    genIndependentID(id) {
      if (id) {
        this.setData({
          independentID: id
        });
      } else {
        this.setData({
          independentID: `goods-list-${~~(Math.random() * 10 ** 8)}`
        });
      }
    }
  }
});
</script>

<template>
<view class="goods-list-wrap wr-class [display:flex] [flex-flow:row_wrap] [justify-content:space-between] [padding:0] [background:#fff]" id="{{independentID}}">
	<block wx:for="{{goodsList}}" wx:for-item="item" wx:key="index">
		<goods-card
		  id="{{independentID}}-gd-{{index}}"
		  data="{{item}}"
		  currency="{{item.currency || '¥'}}"
		  thresholds="{{thresholds}}"
		  class="goods-card-inside"
		  data-index="{{index}}"
		  bind:thumb="onClickGoodsThumb"
		  bind:click="onClickGoods"
		  bind:add-cart="onAddCart"
		/>
	</block>
</view>

</template>

<json>
{
    "component": true,
    "usingComponents": {
        "goods-card": "/components/goods-card/index"
    }
}</json>
