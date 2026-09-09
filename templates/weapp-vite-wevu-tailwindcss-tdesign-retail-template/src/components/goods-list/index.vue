<script setup lang="ts">
import { ref, toRefs, watch } from 'wevu'

interface GoodsListItem {
  currency?: string
  [key: string]: any
}

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class'],
})

const props = withDefaults(defineProps<{
  goodsList?: GoodsListItem[]
  listId?: string
  thresholds?: number[]
}>(), {
  goodsList: () => [],
  listId: '',
  thresholds: () => [],
})

const emit = defineEmits<{
  click: [payload: Record<string, any>]
  addcart: [payload: Record<string, any>]
  thumb: [payload: Record<string, any>]
}>()

const { goodsList, thresholds } = toRefs(props)
const independentID = ref(props.listId || `goods-list-${~~(Math.random() * 10 ** 8)}`)

watch(() => props.listId, (listId) => {
  if (!listId) {
    return
  }
  independentID.value = listId
})

function onClickGoods(payload: Record<string, unknown>, index: number) {
  emit('click', {
    ...payload,
    index,
  })
}

function onAddCart(payload: Record<string, unknown>, index: number) {
  emit('addcart', {
    ...payload,
    index,
  })
}

function onClickGoodsThumb(payload: Record<string, unknown>, index: number) {
  emit('thumb', {
    ...payload,
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

defineComponentJson({
  component: true,
  usingComponents: {
    'goods-card': '/components/goods-card/index',
  },
})
</script>

<template>
  <view :id="independentID" class="goods-list-wrap wr-class flex [flex-flow:row_wrap] justify-between p-0 [background:#fff]">
    <block v-for="(item, index) in goodsList" :key="index">
      <goods-card
        :id="`${independentID}-gd-${index}`"
        :card-id="`${independentID}-gd-${index}`"
        :data="item"
        :currency="item.currency || '¥'"
        :thresholds="thresholds"
        class="goods-card-inside"
        :data-index="index"
        @thumb="onClickGoodsThumb($event, index)"
        @click="onClickGoods($event, index)"
        @add-cart="onAddCart($event, index)"
      />
    </block>
  </view>
</template>

<style>
.goods-list-wrap {
  box-sizing: border-box;
  display: flex;
  flex-flow: row wrap;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  background: #fff;
}

.goods-card-inside {
  display: block;
  width: 342rpx;
  margin-bottom: 16rpx;
}
</style>
