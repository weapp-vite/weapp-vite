<script setup lang="ts">
defineOptions({
  externalClasses: ['wr-class', 'symbol-class', 'decimal-class'],
  useStore: [],
  properties: {
    priceUnit: {
      type: String,
      value: 'fen'
    },
    // 价格单位，分 | 元, fen，yuan
    price: {
      type: null,
      value: '',
      observer(price) {
        this.format(price);
      }
    },
    // 价格, 以分为单位
    type: {
      type: String,
      value: '' //
    },
    //  main 粗体, lighter 细体, mini 黑色, del 中划线, delthrough 中划线，包括货币符号
    symbol: {
      type: String,
      value: '¥' // '￥',
    },
    // 货币符号，默认是人民币符号￥
    fill: Boolean,
    // 是否自动补齐两位小数
    decimalSmaller: Boolean,
    // 小数字号小一点
    lineThroughWidth: {
      type: null,
      value: '0.12em'
    } // 划线价线条高度
  },
  data() {
    return {
      pArr: []
    };
  },
  methods: {
    format(price) {
      price = parseFloat(`${price}`);
      const pArr = [];
      if (!isNaN(price)) {
        const isMinus = price < 0;
        if (isMinus) {
          price = -price;
        }
        if (this.properties.priceUnit === 'yuan') {
          const priceSplit = price.toString().split('.');
          pArr[0] = priceSplit[0];
          pArr[1] = !priceSplit[1] ? '00' : priceSplit[1].length === 1 ? `${priceSplit[1]}0` : priceSplit[1];
        } else {
          price = Math.round(price * 10 ** 8) / 10 ** 8; // 恢复精度丢失
          price = Math.ceil(price); // 向上取整
          pArr[0] = price >= 100 ? `${price}`.slice(0, -2) : '0';
          pArr[1] = `${price + 100}`.slice(-2);
        }
        if (!this.properties.fill) {
          // 如果 fill 为 false， 不显示小数末尾的0
          if (pArr[1] === '00') pArr[1] = '';else if (pArr[1][1] === '0') pArr[1] = pArr[1][0];
        }
        if (isMinus) {
          pArr[0] = `-${pArr[0]}`;
        }
      }
      this.setData({
        pArr
      });
    }
  }
});
</script>

<template>
<wxs module="utils">
	var REGEXP = getRegExp('^\\d+(\\.\\d+)?$');
	function addUnit(value) {
	if (value == null) {
	return '';
	}
	return REGEXP.test('' + value) ? value + 'rpx' : value;
	}
	module.exports = {
	addUnit: addUnit
	};
</wxs>
<view class="price {{type}} wr-class [display:inline] [color:inherit] [font-size:inherit] [text-decoration:inherit] [white-space:nowrap]">
	<view wx:if="{{type === 'delthrough'}}" class="line" style="height:{{utils.addUnit(lineThroughWidth)}};" />
	<view class="symbol symbol-class [display:inline] [color:inherit] [font-size:inherit] [font-size:0.8em] [white-space:nowrap]">{{symbol}}</view>
	<view class="pprice [display:inline] [margin:0_0_0_4rpx] [white-space:nowrap]">
		<view class="integer inline [display:inline] [white-space:nowrap] [color:inherit] [font-size:inherit]">{{pArr[0]}}</view>
		<view wx:if="{{pArr[1]}}" class="decimal inline {{decimalSmaller ? 'smaller' : ''}} decimal-class [display:inline] [white-space:nowrap] [color:inherit] [font-size:inherit] [&_.smaller]:[font-size:0.8em] [&_.smaller]:[vertical-align:baseline]">.{{pArr[1]}}</view>
	</view>
</view>

</template>

<json>
{
  "component": true,
  "usingComponents": {}
}
</json>
