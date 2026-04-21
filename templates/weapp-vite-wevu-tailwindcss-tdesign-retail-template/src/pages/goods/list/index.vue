<script setup lang="ts">
import { onLoad, onReachBottom, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { fetchGoodsList } from '../../../services/good/fetchGoodsList'

type GoodsItem = Record<string, any>

interface GoodsListResult {
  spuList?: GoodsItem[]
  totalCount?: number
}

interface GoodsQueryParams {
  sort: number
  pageNum: number
  pageSize: number
  keyword?: string
  sortType?: number
  minPrice: number
  maxPrice?: number
}

const nativeInstance = useNativeInstance()

const goodsList = ref<GoodsItem[]>([])
const layout = ref(0)
const sorts = ref('')
const overall = ref(1)
const show = ref(false)
const minVal = ref('')
const maxVal = ref('')
const filter = ref({
  overall: 1,
  sorts: '',
  layout: 0,
})
const hasLoaded = ref(false)
const loadMoreStatus = ref(0)
const loading = ref(true)
const keywords = ref('')

let pageNum = 1
const pageSize = 30
let total = 0

function handleFilterChange(e: any) {
  const {
    layout: nextLayout = 0,
    overall: nextOverall = 1,
    sorts: nextSorts = '',
  } = e?.detail || {}
  pageNum = 1
  layout.value = nextLayout
  sorts.value = nextSorts
  overall.value = nextOverall
  filter.value = {
    ...filter.value,
    layout: nextLayout,
    overall: nextOverall,
    sorts: nextSorts,
  }
  loadMoreStatus.value = 0
  void init(true)
}

function generalQueryData(reset = false): GoodsQueryParams {
  const {
    sorts: filterSorts,
    overall: filterOverall,
  } = filter.value
  const params: GoodsQueryParams = {
    sort: 0, // 0 综合，1 价格
    pageNum: 1,
    pageSize,
    keyword: keywords.value,
    minPrice: minVal.value ? Number(minVal.value) * 100 : 0,
    maxPrice: maxVal.value ? Number(maxVal.value) * 100 : undefined,
  }
  if (filterSorts) {
    params.sort = 1
    params.sortType = filterSorts === 'desc' ? 1 : 0
  }
  if (filterOverall) {
    params.sort = 0
  }
  else {
    params.sort = 1
  }
  if (reset) {
    return params
  }
  return {
    ...params,
    pageNum: pageNum + 1,
    pageSize,
  }
}

async function init(reset = true) {
  const params = generalQueryData(reset)
  if (loadMoreStatus.value !== 0) {
    return
  }
  loadMoreStatus.value = 1
  loading.value = true
  try {
    const result = await fetchGoodsList(params as any)
    const code = 'Success'
    const data = result as GoodsListResult
    if (code.toUpperCase() === 'SUCCESS') {
      const spuList = Array.isArray(data.spuList) ? data.spuList : []
      const totalCount = typeof data.totalCount === 'number' ? data.totalCount : 0
      if (totalCount === 0 && reset) {
        total = totalCount
        hasLoaded.value = true
        loadMoreStatus.value = 0
        loading.value = false
        goodsList.value = []
        return
      }
      const nextGoodsList = reset ? spuList : goodsList.value.concat(spuList)
      const nextLoadMoreStatus = nextGoodsList.length === totalCount ? 2 : 0
      pageNum = params.pageNum || 1
      total = totalCount
      goodsList.value = nextGoodsList
      loadMoreStatus.value = nextLoadMoreStatus
    }
    else {
      loading.value = false
      showToast({
        title: '查询失败，请稍候重试',
      })
    }
  }
  catch {
    loading.value = false
  }
  hasLoaded.value = true
  loading.value = false
}

function handleAddCart() {
  showToast({
    context: nativeInstance,
    message: '点击加购',
  })
}

async function gotoGoodsDetail(e: any) {
  const index = Number(e?.detail?.index)
  if (!Number.isFinite(index)) {
    return
  }
  const target = goodsList.value[index]
  const spuId = target?.spuId
  if (!spuId) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  })
}

function showFilterPopup() {
  show.value = true
}

function showFilterPopupClose() {
  show.value = false
}

function onMinValAction(e: any) {
  minVal.value = String(e?.detail?.value ?? '')
}

function onMaxValAction(e: any) {
  maxVal.value = String(e?.detail?.value ?? '')
}

function reset() {
  minVal.value = ''
  maxVal.value = ''
}

function confirm() {
  let message = ''
  if (minVal.value && !maxVal.value) {
    message = `价格最小是${minVal.value}`
  }
  else if (!minVal.value && maxVal.value) {
    message = `价格范围是0-${minVal.value}`
  }
  else if (minVal.value && maxVal.value && Number(minVal.value) <= Number(maxVal.value)) {
    message = `价格范围${minVal.value}-${maxVal.value}`
  }
  else {
    message = '请输入正确范围'
  }
  if (message) {
    showToast({
      context: nativeInstance,
      message,
    })
  }
  pageNum = 1
  show.value = false
  minVal.value = ''
  goodsList.value = []
  loadMoreStatus.value = 0
  maxVal.value = ''
  void init()
}

onLoad((options: any) => {
  keywords.value = String(options?.keywords || '')
  void init(true)
})

onReachBottom(() => {
  if (goodsList.value.length === total) {
    loadMoreStatus.value = 2
    return
  }
  void init(false)
})

defineExpose({
  goodsList,
  layout,
  sorts,
  overall,
  show,
  minVal,
  maxVal,
  filter,
  hasLoaded,
  loadMoreStatus,
  loading,
  handleFilterChange,
  generalQueryData,
  init,
  handleAddCart,
  gotoGoodsDetail,
  showFilterPopup,
  showFilterPopupClose,
  onMinValAction,
  onMaxValAction,
  reset,
  confirm,
})

definePageJson({
  navigationBarTitleText: '商品列表',
  usingComponents: {
    't-input': 'tdesign-miniprogram/input/input',
    't-empty': 'tdesign-miniprogram/empty/empty',
    'goods-list': '/components/goods-list/index',
    'goods-filter': '/components/filter/index',
    'filter-popup': '/components/filter-popup/index',
    'load-more': '/components/load-more/index',
  },
})
</script>

<template>
  <view class="goods-list-container block [&_.t-search]:p-[0_30rpx] [&_.t-search]:bg-white [&_.t-class__input-container]:h-[64rpx] [&_.t-class__input-container]:rounded-[32rpx] [&_.t-search__left-icon]:flex [&_.t-search__left-icon]:items-center [&_.t-search__input]:text-[28rpx] [&_.t-search__input]:text-[rgb(116,116,116)] [&_.category-goods-list]:bg-[#f2f2f2] [&_.category-goods-list]:overflow-y-scroll [&_.category-goods-list]:[-webkit-overflow-scrolling:touch] [&_.category-goods-list]:p-[20rpx_24rpx] [&_.wr-goods-list]:[background:#f2f2f2] [&_.t-image__mask]:flex [&_.empty-wrap]:mt-[184rpx] [&_.empty-wrap]:mb-[120rpx] [&_.empty-wrap]:h-[300rpx] [&_.empty-wrap_.empty-tips_.empty-content_.content-text]:mt-[40rpx] [&_.price-container]:p-[32rpx] [&_.price-container]:h-screen [&_.price-container]:max-w-[632rpx] [&_.price-container]:bg-white [&_.price-container]:rounded-[30rpx_0_0_30rpx] [&_.price-container]:box-border [&_.price-between]:text-[26rpx] [&_.price-between]:font-medium [&_.price-between]:text-[rgba(51,51,51,1)] [&_.price-ipts-wrap]:w-full [&_.price-ipts-wrap]:flex [&_.price-ipts-wrap]:items-center [&_.price-ipts-wrap]:justify-around [&_.price-ipts-wrap]:mt-[24rpx] [&_.price-ipts-wrap_.price-divided]:w-[16rpx] [&_.price-ipts-wrap_.price-divided]:m-[0_24rpx] [&_.price-ipts-wrap_.price-divided]:text-[#333333] [&_.price-ipts-wrap_.t-input__wrapper]:m-0 [&_.price-ipts-wrap_.t-input__content]:text-[24rpx] [&_.price-ipts-wrap_.t-input__placeholder]:text-[24rpx] [&_.price-ipts-wrap_.price-ipt]:rounded-[8rpx]">
    <goods-filter
      wr-class="filter-container"
      :layout="layout"
      :sorts="sorts"
      :overall="overall"
      @change="handleFilterChange"
      @showFilterPopup="showFilterPopup"
    >
      <template #filterPopup>
        <filter-popup

          :show="show"
          @showFilterPopupClose="showFilterPopupClose"
          @reset="reset"
          @confirm="confirm"
        >
          <template #filterSlot>
            <view class="price-container">
              <view class="price-between">
                价格区间
              </view>
              <view class="price-ipts-wrap">
                <t-input
                  align="center"
                  type="number"
                  t-class="price-ipt"
                  placeholder="最低价"
                  :value="minVal"
                  @change="onMinValAction"
                />
                <view class="price-divided">
                  -
                </view>
                <t-input
                  align="center"
                  type="number"
                  t-class="price-ipt"
                  placeholder="最高价"
                  :value="maxVal"
                  @change="onMaxValAction"
                />
              </view>
            </view>
          </template>
        </filter-popup>
      </template>
    </goods-filter>
    <view v-if="goodsList.length === 0 && hasLoaded" class="empty-wrap">
      <t-empty t-class="empty-tips" size="240rpx" description="暂无相关商品" />
    </view>
    <view v-if="goodsList.length" class="category-goods-list">
      <goods-list
        wr-class="wr-goods-list"
        :goodsList="goodsList"
        @click="gotoGoodsDetail"
        @addcart="handleAddCart"
      />
    </view>
    <load-more v-if="goodsList.length > 0" :status="loadMoreStatus" no-more-text="没有更多了" />
  </view>
</template>
