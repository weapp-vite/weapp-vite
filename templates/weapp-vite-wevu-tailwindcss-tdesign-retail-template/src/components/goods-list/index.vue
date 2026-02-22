<script setup lang="ts">
import { ref, toRefs, watch } from 'wevu'

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class'],
})

const props = withDefaults(defineProps<{
  goodsList?: unknown[]
  id?: string
  thresholds?: unknown[]
}>(), {
  goodsList: () => [],
  id: '',
  thresholds: () => [],
})

const emit = defineEmits<{
  click: [payload: Record<string, any>]
  addcart: [payload: Record<string, any>]
  thumb: [payload: Record<string, any>]
}>()

const { goodsList, thresholds } = toRefs(props)
const independentID = ref(props.id || `goods-list-${~~(Math.random() * 10 ** 8)}`)

watch(() => props.id, (id) => {
  if (!id) {
    return
  }
  independentID.value = id
})

function onClickGoods(e: any) {
  const { index } = e.currentTarget.dataset
  emit('click', {
    ...e.detail,
    index,
  })
}

function onAddCart(e: any) {
  const { index } = e.currentTarget.dataset
  emit('addcart', {
    ...e.detail,
    index,
  })
}

function onClickGoodsThumb(e: any) {
  const { index } = e.currentTarget.dataset
  emit('thumb', {
    ...e.detail,
    index,
  })
}

defineExpose({
  goodsList,
  thresholds,
  independentID,
  onClickGoods,
  onAddCart,
  onClickGoodsThumb,
})
</script>

<template>
  <view id="{{independentID}}" class="goods-list-wrap wr-class [display:flex] [flex-flow:row_wrap] [justify-content:space-between] [padding:0] [background:#fff]">
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
}
</json>
