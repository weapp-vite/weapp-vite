<script setup lang="ts">
import { computed, ref, useNativeInstance, watch } from 'wevu'
import { showToast } from '@/hooks/useToast'

type SpecValueId = string | number

interface SkuSpecInfo {
  specId: string
  specValueId: SpecValueId
  specValue?: string
}

interface SkuItem {
  quantity?: number
  price?: number
  skuImage?: string
  specInfo?: SkuSpecInfo[]
}

interface SpecValueItem {
  specValueId: SpecValueId
  specValue: string
  isSelected?: boolean
  hasStockObj?: {
    hasStock: boolean
    specsArray: SpecValueId[][]
  }
}

interface SpecItem {
  specId: string
  title: string
  specValueList: SpecValueItem[]
}

const props = withDefaults(defineProps<{
  src?: string
  title?: string
  show?: boolean
  limitBuyInfo?: string
  isStock?: boolean
  limitMaxCount?: number
  limitMinCount?: number
  skuList?: SkuItem[]
  specList?: SpecItem[]
  outOperateStatus?: boolean
  hasAuth?: boolean
  count?: number
}>(), {
  src: '',
  title: '',
  show: false,
  limitBuyInfo: '',
  isStock: true,
  limitMaxCount: 999,
  limitMinCount: 1,
  skuList: () => [],
  specList: () => [],
  outOperateStatus: false,
  hasAuth: false,
  count: 1,
})

const emit = defineEmits<{
  closeSpecsPopup: [payload: { show: false }]
  change: [payload: { specList: SpecItem[], selectedSku: Record<string, SpecValueId | ''>, isAllSelectedSku: boolean }]
  specsConfirm: []
  addCart: []
  buyNow: [payload: { isAllSelectedSku: boolean }]
  changeNum: [payload: { buyNum: number }]
}>()

const nativeInstance = useNativeInstance()

const buyNum = ref(1)
const isAllSelectedSku = ref(false)
const selectedSku = ref<Record<string, SpecValueId | ''>>({})
const specListState = ref<SpecItem[]>([])

function cloneSpecList(specList: SpecItem[]) {
  return specList.map(spec => ({
    ...spec,
    specValueList: (spec.specValueList || []).map(valueItem => ({
      ...valueItem,
      hasStockObj: valueItem.hasStockObj
        ? {
            hasStock: valueItem.hasStockObj.hasStock,
            specsArray: valueItem.hasStockObj.specsArray.map(item => [...item]),
          }
        : undefined,
    })),
  }))
}

function getSkuSpecsArray(skuItem: SkuItem) {
  return (skuItem.specInfo || []).map(spec => spec.specValueId)
}

function getSelectedSpecMap() {
  return { ...selectedSku.value }
}

function matchesSelection(
  skuItem: SkuItem,
  selection: Record<string, SpecValueId | ''>,
  override?: { specId: string, specValueId: SpecValueId | '' },
) {
  const specInfo = skuItem.specInfo || []
  return specInfo.every((spec) => {
    const selectedValue = override && override.specId === spec.specId
      ? override.specValueId
      : selection[spec.specId]
    if (selectedValue === '' || selectedValue === undefined) {
      return true
    }
    return selectedValue === spec.specValueId
  })
}

function getStockMeta(specValueId: SpecValueId, specId: string) {
  const validSkuList = props.skuList.filter(sku => Number(sku.quantity || 0) > 0)
  const specsArray = validSkuList
    .filter(sku => matchesSelection(sku, getSelectedSpecMap(), { specId, specValueId }))
    .map(getSkuSpecsArray)

  return {
    hasStock: specsArray.length > 0,
    specsArray,
  }
}

function refreshSpecState() {
  const nextSpecList = cloneSpecList(props.specList)
  nextSpecList.forEach((spec) => {
    spec.specValueList.forEach((valueItem) => {
      valueItem.isSelected = selectedSku.value[spec.specId] === valueItem.specValueId
      valueItem.hasStockObj = getStockMeta(valueItem.specValueId, spec.specId)
    })
  })
  specListState.value = nextSpecList
  isAllSelectedSku.value = nextSpecList.length > 0 && nextSpecList.every(spec => selectedSku.value[spec.specId] !== '' && selectedSku.value[spec.specId] !== undefined)
}

function initData() {
  selectedSku.value = Object.fromEntries((props.specList || []).map(spec => [spec.specId, '']))
  specListState.value = cloneSpecList(props.specList)
  refreshSpecState()
}

function getSelectedSpecValues() {
  const selectedValueMap = selectedSku.value
  return specListState.value.flatMap(spec => spec.specValueList.filter(valueItem => valueItem.specValueId === selectedValueMap[spec.specId]))
}

function toChooseItem(e: any) {
  if (!props.isStock) {
    return
  }
  const specId = e?.currentTarget?.dataset?.specid as string
  const specValueId = e?.currentTarget?.dataset?.id as SpecValueId
  const hasStock = !!e?.currentTarget?.dataset?.hasstock
  if (!hasStock) {
    showToast({
      context: nativeInstance as any,
      message: '该规格已售罄',
      icon: '',
      duration: 1000,
    })
    return
  }

  selectedSku.value = {
    ...selectedSku.value,
    [specId]: selectedSku.value[specId] === specValueId ? '' : specValueId,
  }
  refreshSpecState()
  emit('change', {
    specList: specListState.value,
    selectedSku: selectedSku.value,
    isAllSelectedSku: isAllSelectedSku.value,
  })
}

function handlePopupHide() {
  emit('closeSpecsPopup', {
    show: false,
  })
}

function specsConfirm() {
  if (!props.isStock) {
    return
  }
  emit('specsConfirm')
}

function addCart() {
  if (!props.isStock) {
    return
  }
  emit('addCart')
}

function buyNow() {
  if (!props.isStock) {
    return
  }
  emit('buyNow', {
    isAllSelectedSku: isAllSelectedSku.value,
  })
}

function handleBuyNumChange(e: any) {
  const value = Number(e?.detail?.value ?? props.limitMinCount)
  buyNum.value = value
  emit('changeNum', {
    buyNum: value,
  })
}

const selectedSpecValues = computed(() => getSelectedSpecValues())

watch(
  () => props.specList,
  () => {
    initData()
  },
  {
    immediate: true,
    deep: true,
  },
)

watch(
  () => props.count,
  (count) => {
    buyNum.value = count
  },
  {
    immediate: true,
  },
)

defineExpose({
  buyNum,
  isAllSelectedSku,
  selectedSku,
  specListState,
  initData,
  toChooseItem,
  handlePopupHide,
  specsConfirm,
  addCart,
  buyNow,
  handleBuyNumChange,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-image': '/components/webp-image/index',
    't-stepper': 'tdesign-miniprogram/stepper/stepper',
  },
})
</script>

<template>
  <t-popup :visible="show" placement="bottom" @visible-change="handlePopupHide">
    <view class="popup-container bg-[#ffffff] relative z-100 rounded-[16rpx_16rpx_0_0] pb-[calc(env(safe-area-inset-bottom)+20rpx)] [&_.popup-close]:absolute [&_.popup-close]:right-[30rpx] [&_.popup-close]:top-[30rpx] [&_.popup-close]:z-9 [&_.popup-close]:text-[#999999] [&_.single-confirm-btn]:rounded-[48rpx] [&_.single-confirm-btn]:text-[#ffffff] [&_.single-confirm-btn]:m-[0_32rpx] [&_.single-confirm-btn]:text-[32rpx] [&_.single-confirm-btn]:h-[80rpx] [&_.single-confirm-btn]:text-center [&_.single-confirm-btn]:leading-[88rpx] [&_.single-confirm-btn]:bg-[#fa4126] [&_.single-confirm-btn_.disabled]:text-[32rpx] [&_.single-confirm-btn_.disabled]:text-white [&_.single-confirm-btn_.disabled]:bg-[#dddddd]">
      <view class="popup-close" @tap="handlePopupHide">
        <t-icon name="close" size="36rpx" />
      </view>
      <view class="popup-sku-header flex p-[30rpx_28rpx_0_30rpx] [&_.popup-sku-header__img]:size-[176rpx] [&_.popup-sku-header__img]:rounded-[8rpx] [&_.popup-sku-header__img]:[background:#d8d8d8] [&_.popup-sku-header__img]:mr-[24rpx] [&_.popup-sku-header__goods-info]:relative [&_.popup-sku-header__goods-info]:w-[500rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:text-[28rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:leading-[40rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:line-clamp-2 [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:whitespace-normal [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:w-[430rpx] [&_.popup-sku-header__goods-info_.popup-sku__goods-name]:text-ellipsis [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:flex [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:text-[#333333] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:text-[26rpx] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec]:leading-[36rpx] [&_.popup-sku-header__goods-info_.popup-sku__selected-spec_.popup-sku__selected-item]:mr-[10rpx]">
        <t-image t-class="popup-sku-header__img" :src="src" />
        <view class="popup-sku-header__goods-info">
          <view class="popup-sku__goods-name">
            {{ title }}
          </view>
          <view class="goods-price-container">
            <slot name="goods-price" />
          </view>
          <view class="popup-sku__selected-spec">
            <view>选择：</view>
            <view v-for="selectedItem in selectedSpecValues" :key="selectedItem.specValueId" class="popup-sku__selected-item">
              {{ selectedItem.specValue }}
            </view>
          </view>
        </view>
      </view>
      <view class="popup-sku-body m-[0_30rpx_40rpx] max-h-[600rpx] overflow-y-scroll [-webkit-overflow-scrolling:touch] [&_.popup-sku-group-container_.popup-sku-row]:p-[32rpx_0] [&_.popup-sku-group-container_.popup-sku-row]:[border-bottom:1rpx_solid_#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__title]:text-[26rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__title]:text-[#333] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:text-[24rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:text-[#333] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:min-w-[128rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:h-[56rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:bg-[#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:rounded-[8rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:[border:2rpx_solid_#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:m-[19rpx_26rpx_0_0] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:p-[0_16rpx] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:inline-flex [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:items-center [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item]:justify-center [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item_.popup-sku-row__item--active]:[border:2rpx_solid_#fa4126] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item_.popup-sku-row__item--active]:text-[#fa4126] [&_.popup-sku-group-container_.popup-sku-row_.popup-sku-row__item_.popup-sku-row__item--active]:[background:rgba(255,95,21,0.04)] [&_.popup-sku-group-container_.popup-sku-row_.disabled-sku-selected]:[background:#f5f5f5] [&_.popup-sku-group-container_.popup-sku-row_.disabled-sku-selected]:text-[#cccccc] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:flex [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:items-center [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:justify-between [&_.popup-sku-stepper-stock_.popup-sku-stepper-container]:m-[40rpx_0] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title]:flex [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title]:text-[26rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title]:text-[#333] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title_.limit-text]:ml-[10rpx] [&_.popup-sku-stepper-stock_.popup-sku-stepper-container_.popup-sku__stepper-title_.limit-text]:text-[#999999]">
        <view class="popup-sku-group-container">
          <view v-for="item in specListState" :key="item.specId" class="popup-sku-row">
            <view class="popup-sku-row__title">
              {{ item.title }}
            </view>
            <block v-for="valuesItem in item.specValueList" :key="valuesItem.specValueId">
              <view
                :class="`popup-sku-row__item ${valuesItem.isSelected ? 'popup-sku-row__item--active' : ''} ${!valuesItem.hasStockObj?.hasStock || !isStock ? 'disabled-sku-selected' : ''}`"
                :data-specid="item.specId"
                :data-id="valuesItem.specValueId"
                :data-val="valuesItem.specValue"
                :data-hasStock="valuesItem.hasStockObj?.hasStock"
                @tap="toChooseItem"
              >
                {{ valuesItem.specValue }}
              </view>
            </block>
          </view>
        </view>
        <view class="popup-sku-stepper-stock">
          <view class="popup-sku-stepper-container">
            <view class="popup-sku__stepper-title">
              购买数量
              <view v-if="limitBuyInfo" class="limit-text">
                ({{ limitBuyInfo }})
              </view>
            </view>
            <t-stepper :value="buyNum" :min="limitMinCount" :max="limitMaxCount" theme="filled" @change="handleBuyNumChange" />
          </view>
        </view>
      </view>
      <view v-if="outOperateStatus" :class="`single-confirm-btn ${!isStock ? 'disabled' : ''}`" @tap="specsConfirm">
        确定
      </view>
      <view
        v-if="!outOperateStatus"
        :class="`popup-sku-actions flex flex-between ${!isStock ? 'popup-sku-disabled' : ''} text-[32rpx] h-[80rpx] text-center leading-[80rpx] p-[0_20rpx] [&_.sku-operate]:h-[80rpx] [&_.sku-operate]:w-[50%] [&_.sku-operate]:text-white [&_.sku-operate]:rounded-[48rpx] [&_.sku-operate_.sku-operate-addCart]:bg-[#ffece9] [&_.sku-operate_.sku-operate-addCart]:text-[#fa4126] [&_.sku-operate_.sku-operate-addCart]:rounded-[48rpx_0_0_48rpx] [&_.sku-operate_.sku-operate-addCart_.disabled]:[background:rgb(221,221,221)] [&_.sku-operate_.sku-operate-addCart_.disabled]:text-white [&_.sku-operate_.sku-operate-buyNow]:bg-[#fa4126] [&_.sku-operate_.sku-operate-buyNow]:rounded-[0_48rpx_48rpx_0] [&_.sku-operate_.sku-operate-buyNow_.disabled]:text-white [&_.sku-operate_.sku-operate-buyNow_.disabled]:[background:rgb(198,198,198)] [&_.sku-operate_.selected-sku-btn]:w-full`"
      >
        <view class="sku-operate">
          <view :class="`selected-sku-btn sku-operate-addCart ${!isStock ? 'disabled' : ''}`" @tap="addCart">
            加入购物车
          </view>
        </view>
        <view class="sku-operate">
          <view :class="`selected-sku-btn sku-operate-buyNow ${!isStock ? 'disabled' : ''}`" @tap="buyNow">
            立即购买
          </view>
        </view>
      </view>
      <slot name="bottomSlot" />
    </view>
  </t-popup>
</template>
