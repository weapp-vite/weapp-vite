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
  id?: string
  thresholds?: number[]
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
        :data="item"
        :currency="item.currency || '¥'"
        :thresholds="thresholds"
        class="goods-card-inside"
        :data-index="index"
        @thumb="onClickGoodsThumb"
        @click="onClickGoods"
        @add-cart="onAddCart"
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
