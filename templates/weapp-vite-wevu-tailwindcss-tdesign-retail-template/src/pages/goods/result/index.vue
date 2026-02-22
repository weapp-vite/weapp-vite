<script setup lang="ts">
import { onLoad, onReachBottom, ref, useNativeInstance } from 'wevu'
import { getSearchResult } from '../../../services/good/fetchSearchResult'
import Toast from 'tdesign-miniprogram/toast/index'

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

const nativeInstance = useNativeInstance() as any

const goodsList = ref<GoodsItem[]>([])
const layout = ref(0)
const sorts = ref('')
const overall = ref(1)
const show = ref(false)
const minVal = ref('')
const maxVal = ref('')
const minSalePriceFocus = ref(false)
const maxSalePriceFocus = ref(false)
const filter = ref({
  overall: 1,
  sorts: '',
})
const hasLoaded = ref(false)
const keywords = ref('')
const loadMoreStatus = ref(0)
const loading = ref(true)

let total = 0
let pageNum = 1
const pageSize = 30

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
    const result = await getSearchResult(params as any)
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
      nextGoodsList.forEach((item) => {
        const tags = Array.isArray(item?.spuTagList)
          ? item.spuTagList.map((tag: any) => tag?.title).filter((title: string) => Boolean(title))
          : []
        item.tags = tags
        item.hideKey = { desc: true }
      })
      const nextLoadMoreStatus = nextGoodsList.length === totalCount ? 2 : 0
      pageNum = params.pageNum || 1
      total = totalCount
      goodsList.value = nextGoodsList
      loadMoreStatus.value = nextLoadMoreStatus
    }
    else {
      loading.value = false
      wx.showToast({
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

function handleCartTap() {
  wx.switchTab({
    url: '/pages/cart/index',
  })
}

function handleSubmit() {
  goodsList.value = []
  loadMoreStatus.value = 0
  void init(true)
}

function handleAddCart() {
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message: '点击加购',
  })
}

function gotoGoodsDetail(e: any) {
  const index = Number(e?.detail?.index)
  if (!Number.isFinite(index)) {
    return
  }
  const target = goodsList.value[index]
  const spuId = target?.spuId
  if (!spuId) {
    return
  }
  wx.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  })
}

function handleFilterChange(e: any) {
  const {
    overall: nextOverall = 1,
    sorts: nextSorts = '',
    layout: nextLayout = layout.value,
  } = e?.detail || {}
  filter.value = {
    sorts: nextSorts,
    overall: nextOverall,
  }
  sorts.value = nextSorts
  overall.value = nextOverall
  layout.value = nextLayout
  pageNum = 1
  goodsList.value = []
  loadMoreStatus.value = 0
  if (total) {
    void init(true)
  }
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
    Toast({
      context: nativeInstance,
      selector: '#t-toast',
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
  const searchValue = String(options?.searchValue || '')
  keywords.value = searchValue
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
  minSalePriceFocus,
  maxSalePriceFocus,
  filter,
  hasLoaded,
  keywords,
  loadMoreStatus,
  loading,
  generalQueryData,
  init,
  handleCartTap,
  handleSubmit,
  handleAddCart,
  gotoGoodsDetail,
  handleFilterChange,
  showFilterPopup,
  showFilterPopupClose,
  onMinValAction,
  onMaxValAction,
  reset,
  confirm,
})
</script>

<template>
<view class="result-container [display:block] [&_.t-search]:[padding:0_30rpx] [&_.t-search]:[background-color:#fff] [&_.t-class__input-container]:[height:64rpx] [&_.t-class__input-container]:[border-radius:32rpx] [&_.t-search__left-icon]:[display:flex] [&_.t-search__left-icon]:[align-items:center] [&_.t-search__input]:[font-size:28rpx] [&_.t-search__input]:[color:#333] [&_.category-goods-list]:[background-color:#f2f2f2] [&_.category-goods-list]:[overflow-y:scroll] [&_.category-goods-list]:[padding:20rpx_24rpx] [&_.category-goods-list]:[-webkit-overflow-scrolling:touch] [&_.wr-goods-list]:[background:#f2f2f2] [&_.t-image__mask]:[display:flex] [&_.empty-wrap]:[margin-top:184rpx] [&_.empty-wrap]:[margin-bottom:120rpx] [&_.empty-wrap]:[height:300rpx] [&_.empty-wrap_.empty-tips_.empty-content_.content-text]:[margin-top:40rpx] [&_.price-container]:[padding:32rpx] [&_.price-container]:[height:100vh] [&_.price-container]:[max-width:632rpx] [&_.price-container]:[background-color:#fff] [&_.price-container]:[border-radius:30rpx_0_0_30rpx] [&_.price-between]:[font-size:26rpx] [&_.price-between]:[font-weight:500] [&_.price-between]:[color:rgba(51,_51,_51,_1)] [&_.price-ipts-wrap]:[width:100%] [&_.price-ipts-wrap]:[display:flex] [&_.price-ipts-wrap]:[flex-direction:row] [&_.price-ipts-wrap]:[justify-content:space-around] [&_.price-ipts-wrap]:[margin-top:24rpx] [&_.price-ipts-wrap_.price-divided]:[position:relative] [&_.price-ipts-wrap_.price-divided]:[width:22rpx] [&_.price-ipts-wrap_.price-divided]:[margin:0_20rpx] [&_.price-ipts-wrap_.price-divided]:[color:#222427] [&_.price-ipts-wrap_.price-ipt]:[box-sizing:border-box] [&_.price-ipts-wrap_.price-ipt]:[width:246rpx] [&_.price-ipts-wrap_.price-ipt]:[font-size:24rpx] [&_.price-ipts-wrap_.price-ipt]:[height:56rpx] [&_.price-ipts-wrap_.price-ipt]:[padding:0_24rpx] [&_.price-ipts-wrap_.price-ipt]:[text-align:center] [&_.price-ipts-wrap_.price-ipt]:[border-radius:8rpx] [&_.price-ipts-wrap_.price-ipt]:[color:#333] [&_.price-ipts-wrap_.price-ipt]:[background:rgba(245,_245,_245,_1)] [&_.t-input__control]:[font-size:24rpx] [&_.t-input__control]:[text-align:center]">
  <t-search
    t-class="t-search"
    t-class-input-container="t-class__input-container"
    t-class-left="t-search__left-icon"
    t-class-input="t-search__input"
    value="{{keywords}}"
    leftIcon=""
    placeholder="iPhone12pro"
    bind:submit="handleSubmit"
  >
    <t-icon slot="left-icon" prefix="wr" name="search" size="40rpx" color="#bbb" />
  </t-search>
  <filter
    wr-class="filter-container"
    bind:change="handleFilterChange"
    layout="{{layout}}"
    sorts="{{sorts}}"
    overall="{{overall}}"
    bind:showFilterPopup="showFilterPopup"
  >
    <filter-popup
      show="{{show}}"
      slot="filterPopup"
      bind:showFilterPopupClose="showFilterPopupClose"
      bind:reset="reset"
      bind:confirm="confirm"
    >
      <view class="price-container" slot="filterSlot">
        <view class="price-between">价格区间</view>
        <view class="price-ipts-wrap">
          <t-input
            type="number"
            t-class="price-ipt"
            t-class-input="t-class-input"
            placeholder="最低价"
            value="{{minVal}}"
            bindchange="onMinValAction"
          />
          <view class="price-divided">-</view>
          <t-input
            type="number"
            t-class="price-ipt"
            t-class-input="t-class-input"
            placeholder="最高价"
            value="{{maxVal}}"
            bindchange="onMaxValAction"
          />
        </view>
      </view>
    </filter-popup>
  </filter>
  <view class="empty-wrap" wx:if="{{goodsList.length === 0 && hasLoaded}}">
    <t-empty t-class="empty-tips" size="240rpx" description="暂无相关商品" />
  </view>
  <view class="category-goods-list" wx:if="{{goodsList.length}}">
    <goods-list
      wr-class="wr-goods-list"
      goodsList="{{goodsList}}"
      bind:click="gotoGoodsDetail"
      bind:addcart="handleAddCart"
    />
  </view>
  <load-more wx:if="{{goodsList.length > 0}}" status="{{loadMoreStatus}}" no-more-text="没有更多了" />
</view>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "搜索",
  "usingComponents": {
    "t-search": "tdesign-miniprogram/search/search",
    "t-input": "tdesign-miniprogram/input/input",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "goods-list": "/components/goods-list/index",
    "filter": "/components/filter/index",
    "filter-popup": "/components/filter-popup/index",
    "load-more": "/components/load-more/index",
    "t-icon": "tdesign-miniprogram/icon/icon"
  },
  "onReachBottomDistance": 50
}</json>
