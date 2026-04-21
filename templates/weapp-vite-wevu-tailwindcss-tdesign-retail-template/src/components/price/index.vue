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
const LENGTH_REGEXP = /^\d+(?:\.\d+)?$/

function addUnit(value: string | number | null | undefined) {
  if (value == null) {
    return ''
  }
  return LENGTH_REGEXP.test(`${value}`) ? `${value}rpx` : value
}

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

defineComponentJson({
  component: true,
  usingComponents: {},
})
</script>

<template>
  <view :class="`price ${type} wr-class inline text-inherit [font-size:inherit] [text-decoration:inherit] whitespace-nowrap`">
    <view v-if="type === 'delthrough'" class="line" :style="`height:${addUnit(lineThroughWidth)};`" />
    <view class="symbol symbol-class inline text-inherit [font-size:inherit] text-[0.8em] whitespace-nowrap">
      {{ symbol }}
    </view>
    <view class="pprice inline m-[0_0_0_4rpx] whitespace-nowrap">
      <view class="integer inline [display:inline] whitespace-nowrap text-inherit [font-size:inherit]">
        {{ pArr[0] }}
      </view>
      <view v-if="pArr[1]" :class="`decimal inline ${decimalSmaller ? 'smaller' : ''} decimal-class whitespace-nowrap text-inherit [font-size:inherit] [&_.smaller]:text-[0.8em] [&_.smaller]:align-baseline`">
        .{{ pArr[1] }}
      </view>
    </view>
  </view>
</template>
