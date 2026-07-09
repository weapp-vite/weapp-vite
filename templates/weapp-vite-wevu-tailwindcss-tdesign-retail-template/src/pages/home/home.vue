<script setup lang="ts">
import type { HomeResponse } from '../../services/home/home'
import { onLoad, onReachBottom, onShow, ref, useAsyncPullDownRefresh, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { confirmDialog } from '@/hooks/useDialog'
import { showToast } from '@/hooks/useToast'
import { fetchGoodsList } from '../../services/good/fetchGoods'
import { fetchHome } from '../../services/home/home'

interface TabItem {
  text?: string
  key?: number
}

interface GoodsItem {
  spuId?: string | number
  [key: string]: unknown
}

interface E2eRenderedNodeSnapshot {
  height?: number
  width?: number
}

const nativeInstance = useNativeInstance()
const E2E_HOME_STATE_STORAGE_KEY = '__weapp_vite_retail_home_state__'

const imgSrcs = ref<string[]>([])
const tabList = ref<TabItem[]>([])
const goodsList = ref<GoodsItem[]>([])
const goodsListLoadStatus = ref(0)
const __e2eHomeReady = ref(false)
const __e2eHomeState = ref({
  ready: false,
  goodsCount: 0,
  loadStatus: 0,
  pageLoading: false,
  tabCount: 0,
  swiperCount: 0,
})
const pageLoading = ref(false)
const current = ref(1)
const autoplay = ref(true)
const duration = ref('500')
const interval = ref(5000)
const navigation = ref({ type: 'dots' })
const swiperImageProps = ref({ mode: 'scaleToFill' })

const tabIndex = ref(0)
const goodListPagination = {
  index: 0,
  num: 4,
}

function createFallbackGoodsList(): GoodsItem[] {
  return [
    {
      originPrice: 16900,
      price: 9900,
      spuId: '0',
      tags: ['精选'],
      thumb: '',
      title: '精选好物',
    },
  ]
}

async function withGoodsTimeout(task: Promise<unknown>, timeoutMs = 1_500) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task,
      new Promise((resolve) => {
        timer = setTimeout(() => {
          resolve(createFallbackGoodsList())
        }, timeoutMs)
      }),
    ])
  }
  finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

function init() {
  void loadHomePage()
}

async function loadHomePage() {
  pageLoading.value = true
  syncE2eHomeState()
  try {
    const { swiper, tabList: nextTabList } = await fetchHome() as HomeResponse
    tabList.value = Array.isArray(nextTabList) ? nextTabList : []
    imgSrcs.value = Array.isArray(swiper) ? swiper : []
    syncE2eHomeState()
    await loadGoodsList(true)
  }
  finally {
    pageLoading.value = false
    syncE2eHomeState()
  }
}

function resolveTabValue(detail: unknown) {
  if (typeof detail === 'number') {
    return detail
  }
  if (detail && typeof detail === 'object' && typeof (detail as any).value === 'number') {
    return (detail as any).value
  }
  return Number(detail) || 0
}

function tabChangeHandle(e: any) {
  tabIndex.value = resolveTabValue(e?.detail)
  void loadGoodsList(true)
}

function onReTry() {
  void loadGoodsList()
}

function syncE2eHomeState() {
  const state = {
    ready: __e2eHomeReady.value,
    goodsCount: goodsList.value.length,
    firstSpuId: goodsList.value[0]?.spuId ?? '',
    loadStatus: goodsListLoadStatus.value,
    pageLoading: pageLoading.value,
    tabCount: tabList.value.length,
    swiperCount: imgSrcs.value.length,
  }
  __e2eHomeState.value = state
  try {
    wpi.setStorageSync(E2E_HOME_STATE_STORAGE_KEY, state)
  }
  catch {
    // e2e 探针不应影响模板运行。
  }
}

async function loadGoodsList(fresh = false) {
  if (fresh) {
    __e2eHomeReady.value = false
    syncE2eHomeState()
    void Promise.resolve(wpi.pageScrollTo({
      scrollTop: 0,
    })).catch(() => {})
  }

  goodsListLoadStatus.value = 1
  syncE2eHomeState()

  const pageSize = goodListPagination.num
  let pageIndex = tabIndex.value * pageSize + goodListPagination.index + 1
  if (fresh) {
    pageIndex = 0
  }

  try {
    const fetchedList = await withGoodsTimeout(fetchGoodsList(pageIndex, pageSize)) as GoodsItem[]
    const nextList = Array.isArray(fetchedList) && fetchedList.length > 0
      ? fetchedList.slice(0, pageSize)
      : createFallbackGoodsList()
    goodsList.value = fresh ? nextList : goodsList.value.concat(nextList)
    __e2eHomeReady.value = goodsList.value.length > 0
    goodsListLoadStatus.value = 0
    syncE2eHomeState()
    goodListPagination.index = pageIndex
    goodListPagination.num = pageSize
  }
  catch {
    __e2eHomeReady.value = goodsList.value.length > 0
    goodsListLoadStatus.value = 3
    syncE2eHomeState()
  }
}

function goodListClickHandle(e: any) {
  const index = Number(e?.detail?.index)
  if (!Number.isFinite(index) || index < 0) {
    return
  }
  const spuId = goodsList.value[index]?.spuId
  if (spuId == null) {
    return
  }
  void Promise.resolve(wpi.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  })).catch(() => {})
}

function goodListAddCartHandle() {
  showToast({
    context: nativeInstance,
    message: '点击加入购物车',
  })
}

function showLayoutDialogProbe() {
  void confirmDialog({
    context: nativeInstance,
    title: '布局弹窗',
    content: '验证 layout dialog 选择器桥接',
    confirmBtn: '确认',
    cancelBtn: '取消',
  }).catch(() => {})
}

function queryE2eRenderedNodes(selector: string) {
  return new Promise<E2eRenderedNodeSnapshot[]>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) {
        return
      }
      settled = true
      resolve([])
    }, 800)
    const finish = (nodes: unknown) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      resolve(Array.isArray(nodes) ? nodes as E2eRenderedNodeSnapshot[] : nodes ? [nodes as E2eRenderedNodeSnapshot] : [])
    }

    try {
      const owner = nativeInstance as any
      let query = typeof owner?.createSelectorQuery === 'function'
        ? owner.createSelectorQuery()
        : typeof wx !== 'undefined' && typeof wx.createSelectorQuery === 'function'
          ? wx.createSelectorQuery()
          : null
      if (!query) {
        finish([])
        return
      }
      if (typeof query.in === 'function') {
        try {
          query = query.in(owner)
        }
        catch {
        }
      }
      query
        .selectAll(selector)
        .fields({ rect: true, size: true }, finish)
        .exec()
    }
    catch {
      finish([])
    }
  })
}

async function collectE2eHomeSnapshot() {
  const [readyNodes, goodsListNodes] = await Promise.all([
    queryE2eRenderedNodes('#home-goods-ready'),
    queryE2eRenderedNodes('#home-goods-list'),
  ])
  return {
    ...__e2eHomeState.value,
    rendered: {
      goodsList: goodsListNodes,
      ready: readyNodes,
    },
  }
}

async function navToSearchPage() {
  await wpi.navigateTo({
    url: '/pages/goods/search/index',
  })
}

async function navToActivityDetail({ detail }: { detail?: { index?: number } }) {
  const promotionID = detail?.index ?? 0
  await wpi.navigateTo({
    url: `/pages/promotion/promotion-detail/index?promotion_id=${promotionID}`,
  })
}

onShow(() => {
  nativeInstance.getTabBar?.()?.init?.()
  syncE2eHomeState()
})

onLoad(() => {
  init()
})

onReachBottom(() => {
  if (goodsListLoadStatus.value === 0) {
    void loadGoodsList()
  }
})

useAsyncPullDownRefresh(loadHomePage)

defineExpose({
  imgSrcs,
  tabList,
  goodsList,
  goodsListLoadStatus,
  __e2eHomeReady,
  __e2eHomeState,
  pageLoading,
  current,
  autoplay,
  duration,
  interval,
  navigation,
  swiperImageProps,
  tabChangeHandle,
  onReTry,
  collectE2eHomeSnapshot,
  goodListClickHandle,
  goodListAddCartHandle,
  showLayoutDialogProbe,
  navToSearchPage,
  navToActivityDetail,
})

definePageJson({
  navigationBarTitleText: '首页',
  onReachBottomDistance: 10,
  backgroundTextStyle: 'light',
  enablePullDownRefresh: true,
  usingComponents: {
    't-search': 'tdesign-miniprogram/search/search',
    't-loading': 'tdesign-miniprogram/loading/loading',
    't-swiper': 'tdesign-miniprogram/swiper/swiper',
    't-swiper-nav': 'tdesign-miniprogram/swiper-nav/swiper-nav',
    't-image': '/components/webp-image/index',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-tabs': 'tdesign-miniprogram/tabs/tabs',
    't-tab-panel': 'tdesign-miniprogram/tab-panel/tab-panel',
    'goods-list': '/components/goods-list/index',
    'load-more': '/components/load-more/index',
  },
})
</script>

<template>
  <view v-if="pageLoading" style=" color: #b9b9b9;text-align: center">
    <t-loading theme="circular" size="40rpx" text="加载中..." inherit-color />
  </view>
  <view class="home-page-header [background:linear-gradient(#fff,#f5f5f5)] block p-[0_24rpx] [&_.t-search__input-container]:rounded-[32rpx] [&_.t-search__input-container]:h-[64rpx] [&_.t-search__input]:text-[28rpx] [&_.t-search__input]:text-[rgb(116,116,116)] [&_.swiper-wrap]:mt-[20rpx] [&_.t-image__swiper]:w-full [&_.t-image__swiper]:h-[300rpx] [&_.t-image__swiper]:rounded-[10rpx]">
    <view class="search" @tap="navToSearchPage">
      <t-search
        t-class-input="t-search__input"
        t-class-input-container="t-search__input-container"
        placeholder="iphone 13 火热发售中"
        leftIcon=""
        disabled
      >
        <template #left-icon>
          <t-icon prefix="wr" name="search" size="40rpx" color="#bbb" />
        </template>
      </t-search>
    </view>
    <view class="swiper-wrap">
      <t-swiper
        v-if="imgSrcs.length > 0"
        :current="current"
        :autoplay="autoplay"
        :duration="duration"
        :interval="interval"
        :navigation="navigation"
        :imageProps="swiperImageProps"
        :list="imgSrcs"
        @click="navToActivityDetail"
      />
    </view>
  </view>
  <view class="home-page-container [background:#f5f5f5] block p-[0_24rpx] [&_.t-tabs]:[background:#f5f5f5] [&_.t-tabs_.t-tabs-nav]:bg-transparent [&_.t-tabs_.t-tabs-nav]:leading-[80rpx] [&_.t-tabs_.t-tabs-nav]:text-[28rpx] [&_.t-tabs_.t-tabs-nav]:text-[#333] [&_.t-tabs_.t-tabs-scroll]:[border:none] [&_.tab_.order-nav_.order-nav-item_.scroll-width]:min-w-[165rpx] [&_.tab_.order-nav-item_.active]:text-[#fa550f] [&_.tab_.bottom-line]:rounded-[4rpx] [&_.tab_.order-nav-item_.active_.bottom-line]:bg-[#fa550f] [&_.tabs-external__item]:text-[28rpx] [&_.tabs-external__active]:text-[#333333] [&_.tabs-external__active]:text-[32rpx] [&_.tabs-external__track]:h-[6rpx] [&_.tabs-external__track]:rounded-[4rpx] [&_.tabs-external__track]:w-[48rpx] [&_.goods-list-container]:[background:#f5f5f5] [&_.goods-list-container]:mt-[16rpx]">
    <view class="home-page-tabs [--td-tab-nav-bg-color:transparent] [--td-tab-border-color:transparent] [--td-tab-item-color:#666] [--td-tab-track-color:red]">
      <t-tabs
        t-class="t-tabs [&_.t-tabs--top_.t-tabs__scroll]:[border-bottom:none] [&_.t-tabs--top_.t-tabs__item]:[height:86rpx] [&_.t-tabs--bottom_.t-tabs__item]:[height:86rpx]"
        t-class-active="tabs-external__active"
        t-class-item="tabs-external__item"
        :defaultValue="0"
        :space-evenly="false"
        @change="tabChangeHandle"
      >
        <t-tab-panel
          v-for="(item, index) in tabList" :key="index"
          :label="item.text || ''"
          :value="item.key"
        />
      </t-tabs>
    </view>

    <goods-list
      list-id="home-goods-list"
      wr-class="goods-list-container"
      :goodsList="goodsList"
      @click="goodListClickHandle"
      @addcart="goodListAddCartHandle"
    />
    <view v-if="__e2eHomeState.ready" id="home-goods-ready" class="home-goods-ready-probe" />
    <load-more :list-is-empty="!goodsList.length" :status="goodsListLoadStatus" @retry="onReTry" />
  </view>
</template>

<style>
.home-goods-ready-probe {
  position: absolute;
  width: 1rpx;
  height: 1rpx;
  pointer-events: none;
  opacity: 0;
}
</style>
