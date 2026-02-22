<script setup lang="ts">
import { computed, toRefs } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class', 'symbol-class', 'decimal-class'],
  useStore: [],
})

const props = withDefaults(defineProps<{
  priceUnit?: 'fen' | 'yuan'
  price?: string | number | null
  type?: string
  symbol?: string
  fill?: boolean
  decimalSmaller?: boolean
  lineThroughWidth?: string | number
}>(), {
  priceUnit: 'fen',
  price: '',
  type: '',
  symbol: '¥',
  fill: false,
  decimalSmaller: false,
  lineThroughWidth: '0.12em',
})

const { type, symbol, decimalSmaller, lineThroughWidth } = toRefs(props)

function format(priceLike: unknown) {
  let price = Number.parseFloat(`${priceLike}`)
  const next: string[] = []
  if (!Number.isNaN(price)) {
    const isMinus = price < 0
    if (isMinus) {
      price = -price
    }
    if (props.priceUnit === 'yuan') {
      const priceSplit = price.toString().split('.')
      next[0] = priceSplit[0]
      next[1] = !priceSplit[1] ? '00' : priceSplit[1].length === 1 ? `${priceSplit[1]}0` : priceSplit[1]
    }
    else {
      price = Math.round(price * 10 ** 8) / 10 ** 8
      price = Math.ceil(price)
      next[0] = price >= 100 ? `${price}`.slice(0, -2) : '0'
      next[1] = `${price + 100}`.slice(-2)
    }

    if (!props.fill) {
      if (next[1] === '00') {
        next[1] = ''
      }
      else if (next[1]?.[1] === '0') {
        next[1] = next[1][0]
      }
    }
    if (isMinus) {
      next[0] = `-${next[0]}`
    }
  }
  return next
}

const pArr = computed(() => format(props.price))

defineExpose({
  type,
  symbol,
  decimalSmaller,
  lineThroughWidth,
  pArr,
})
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
    <view class="symbol symbol-class [display:inline] [color:inherit] [font-size:inherit] [font-size:0.8em] [white-space:nowrap]">
      {{ symbol }}
    </view>
    <view class="pprice [display:inline] [margin:0_0_0_4rpx] [white-space:nowrap]">
      <view class="integer inline [display:inline] [white-space:nowrap] [color:inherit] [font-size:inherit]">
        {{ pArr[0] }}
      </view>
      <view wx:if="{{pArr[1]}}" class="decimal inline {{decimalSmaller ? 'smaller' : ''}} decimal-class [display:inline] [white-space:nowrap] [color:inherit] [font-size:inherit] [&_.smaller]:[font-size:0.8em] [&_.smaller]:[vertical-align:baseline]">
        .{{ pArr[1] }}
      </view>
    </view>
  </view>
</template>

<json>
{
  "component": true,
  "usingComponents": {}
}
</json>
