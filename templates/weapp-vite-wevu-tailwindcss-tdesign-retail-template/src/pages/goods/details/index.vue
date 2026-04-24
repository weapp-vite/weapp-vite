<script setup lang="ts">
import type { Activity } from '../../../model/activity'
import type { GoodsDetailsComments, GoodsDetailsCommentsCount } from '../../../model/detailsComments'
import type { GoodDetail } from '../../../model/good'
import { computed, onLoad, onShareAppMessage, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { cdnBase } from '../../../config/index'
import { fetchActivityList } from '../../../services/activity/fetchActivityList'
import { fetchGood } from '../../../services/good/fetchGood'
import { getGoodsDetailsCommentList, getGoodsDetailsCommentsCount } from '../../../services/good/fetchGoodsDetailsComments'

type DetailSpecItem = NonNullable<GoodDetail['specList']>[number]
type DetailSpecValueItem = DetailSpecItem['specValueList'][number]
type DetailSkuItem = NonNullable<GoodDetail['skuList']>[number]
type SelectedSkuMap = Record<string, string | number | ''>
type CommentItem = GoodsDetailsComments['homePageComments'][number] & {
  isAnonymity?: boolean
}

interface CommentViewItem {
  goodsSpu: string
  userName: string
  commentScore: number
  commentContent: string
  userHeadUrl: string
}

interface CommentStatistics {
  badCount: number
  commentCount: number
  goodCount: number
  goodRate: number
  hasImageCount: number
  middleCount: number
}

interface PromotionViewItem {
  tag: string
  label: string
}

interface JumpItem {
  title: string
  url: string
  iconName: string
  showCartNum?: boolean
}

interface NormalizedSkuItem {
  skuId: string
  quantity: number
  price: number
  skuImage: string
  specInfo: DetailSkuItem['specInfo']
}

const nativeInstance = useNativeInstance()

const anonymousAvatar = 'https://tdesign.gtimg.com/miniprogram/template/retail/avatar/avatar1.png'
const recLeftImg = `${cdnBase}/common/rec-left.png`
const recRightImg = `${cdnBase}/common/rec-right.png`
const jumpArray: JumpItem[] = [
  {
    title: '首页',
    url: '/pages/home/home',
    iconName: 'home',
  },
  {
    title: '购物车',
    url: '/pages/cart/index',
    iconName: 'cart',
    showCartNum: true,
  },
]

const commentsList = ref<CommentViewItem[]>([])
const commentsStatistics = ref<CommentStatistics>({
  badCount: 0,
  commentCount: 0,
  goodCount: 0,
  goodRate: 0,
  hasImageCount: 0,
  middleCount: 0,
})
const isShowPromotionPop = ref(false)
const activityList = ref<Activity[]>([])
const details = ref<GoodDetail | null>(null)
const isStock = ref(true)
const cartNum = ref(0)
const soldout = ref(false)
const buttonType = ref(1)
const buyNum = ref(1)
const selectedAttrStr = ref('')
const skuArray = ref<NormalizedSkuItem[]>([])
const primaryImage = ref('')
const specImg = ref('')
const isSpuSelectPopupShow = ref(false)
const isAllSelectedSku = ref(false)
const buyType = ref(0)
const outOperateStatus = ref(false)
const selectSkuSellsPrice = ref(0)
const maxLinePrice = ref(0)
const minSalePrice = ref(0)
const maxSalePrice = ref(0)
const list = ref<PromotionViewItem[]>([])
const spuId = ref('')
const current = ref(0)
const autoplay = ref(true)
const duration = ref(500)
const interval = ref(5000)
const soldNum = ref(0)
const selectedSkuItem = ref<NormalizedSkuItem | null>(null)
const navigation = {
  type: 'fraction',
} as const

const detailImages = computed(() => details.value?.images ?? [])
const detailDesc = computed(() => details.value?.desc ?? [])
const detailSpecList = computed(() => details.value?.specList ?? [])
const detailLimitBuyInfo = computed(() => details.value?.limitInfo?.[0]?.text ?? '')
const detailTitle = computed(() => details.value?.title ?? '')
const detailPrimaryImage = computed(() => details.value?.primaryImage ?? '')
const intro = computed(() => details.value?.etitle ?? '')
const visibleActivityList = computed(() => activityList.value.slice(0, 4))

function obj2Params(obj: Record<string, string>, encode = false) {
  return Object.keys(obj).map((key) => {
    const value = obj[key]
    return `${key}=${encode ? encodeURIComponent(value) : value}`
  }).join('&')
}

function handlePopupHide() {
  isSpuSelectPopupShow.value = false
}

function showSkuSelectPopup(type?: number) {
  const nextType = typeof type === 'number' ? type : 0
  buyType.value = nextType
  outOperateStatus.value = nextType >= 1
  isSpuSelectPopupShow.value = true
}

function buyItNow() {
  showSkuSelectPopup(1)
}

function toAddCart() {
  showSkuSelectPopup(2)
}

async function toNav(payload: { url?: string }) {
  if (!payload.url) {
    return
  }
  await wpi.switchTab({
    url: payload.url,
  })
}

function normalizeSkuTree(skuTree: DetailSpecItem[]) {
  return skuTree.reduce<Record<string, DetailSpecValueItem[]>>((tree, treeItem) => {
    tree[treeItem.specId] = treeItem.specValueList
    return tree
  }, {})
}

function getSelectedSkuValues(skuTree: DetailSpecItem[], selectedSku: SelectedSkuMap) {
  const normalizedTree = normalizeSkuTree(skuTree)
  return Object.keys(selectedSku).reduce<DetailSpecValueItem[]>((selectedValues, skuKeyStr) => {
    const skuValues = normalizedTree[skuKeyStr] ?? []
    const skuValueId = selectedSku[skuKeyStr]
    if (skuValueId !== '') {
      const skuValue = skuValues.find(value => value.specValueId === skuValueId)
      if (skuValue) {
        selectedValues.push(skuValue)
      }
    }
    return selectedValues
  }, [])
}

function selectSpecsName(nextSelectSpecsName: string) {
  selectedAttrStr.value = nextSelectSpecsName || ''
}

function getSkuItem(specList: DetailSpecItem[], selectedSku: SelectedSkuMap) {
  const selectedSkuValues = getSelectedSkuValues(specList, selectedSku)
  let nextSelectedAttrStr = ' 件'
  selectedSkuValues.forEach((item) => {
    nextSelectedAttrStr += `，${item.specValue}`
  })

  const skuItem = skuArray.value.find((item) => {
    return (item.specInfo || []).every((subItem) => {
      return selectedSku[subItem.specId] && selectedSku[subItem.specId] === subItem.specValueId
    })
  }) ?? null

  selectSpecsName(selectedSkuValues.length > 0 ? nextSelectedAttrStr : '')
  selectedSkuItem.value = skuItem
  selectSkuSellsPrice.value = skuItem?.price ?? 0
  specImg.value = skuItem?.skuImage || primaryImage.value
}

function chooseSpecItem(payload: {
  specList: DetailSpecItem[]
  selectedSku: SelectedSkuMap
  isAllSelectedSku: boolean
}) {
  isAllSelectedSku.value = payload.isAllSelectedSku
  if (!payload.isAllSelectedSku) {
    selectSkuSellsPrice.value = 0
  }
  getSkuItem(payload.specList, payload.selectedSku)
}

function addCart() {
  showToast({
    context: nativeInstance as any,
    message: isAllSelectedSku.value ? '点击加入购物车' : '请选择规格',
    icon: '',
    duration: 1000,
  })
}

async function gotoBuy() {
  const detail = details.value
  if (!isAllSelectedSku.value || !detail) {
    showToast({
      context: nativeInstance as any,
      message: '请选择规格',
      icon: '',
      duration: 1000,
    })
    return
  }

  handlePopupHide()

  const fallbackSkuId = detail.skuList?.[0]?.skuId ?? ''
  const nextSkuId = selectedSkuItem.value?.skuId || fallbackSkuId
  const specInfo = detail.specList?.map(item => ({
    specTitle: item.title,
    specValue: item.specValueList[0]?.specValue ?? '',
  })) ?? []

  const query = {
    quantity: buyNum.value,
    storeId: '1',
    goodsName: detail.title,
    skuId: nextSkuId,
    available: detail.available,
    price: detail.minSalePrice,
    specInfo,
    primaryImage: detail.primaryImage,
    spuId: detail.spuId,
    thumb: detail.primaryImage,
    title: detail.title,
  }

  let urlQueryStr = obj2Params({
    goodsRequestList: JSON.stringify([query]),
  })
  urlQueryStr = urlQueryStr ? `?${urlQueryStr}` : ''

  await wpi.navigateTo({
    url: `/pages/order/order-confirm/index${urlQueryStr}`,
  })
}

function specsConfirm() {
  if (buyType.value === 1) {
    void gotoBuy()
    return
  }
  addCart()
}

function changeNum(payload: { buyNum?: number }) {
  buyNum.value = Number(payload.buyNum ?? 1)
}

function closePromotionPopup() {
  isShowPromotionPop.value = false
}

async function promotionChange({ index }: { index: number }) {
  await wpi.navigateTo({
    url: `/pages/promotion/promotion-detail/index?promotion_id=${index}`,
  })
}

function showPromotionPopup() {
  isShowPromotionPop.value = true
}

function normalizeSkuList(detail: GoodDetail) {
  return (detail.skuList || []).map((item) => {
    const salePrice = Number(item.priceInfo?.find(price => price.priceType === 1)?.price ?? 0)
    return {
      skuId: item.skuId,
      quantity: item.stockInfo?.stockQuantity ?? 0,
      price: salePrice,
      skuImage: item.skuImage || detail.primaryImage,
      specInfo: item.specInfo,
    }
  })
}

function normalizePromotionList(source: Activity[]) {
  return source.map((item) => {
    return {
      tag: item.promotionSubCode === 'MYJ' ? '满减' : '满折',
      label: item.activityLadder?.[0]?.label ?? '满100元减99.9元',
    }
  })
}

async function getDetail(nextSpuId: string) {
  const [detail, activities] = await Promise.all([
    fetchGood(nextSpuId),
    fetchActivityList(),
  ])

  details.value = detail
  activityList.value = activities
  skuArray.value = normalizeSkuList(detail)
  primaryImage.value = detail.primaryImage || ''
  specImg.value = detail.primaryImage || ''
  isStock.value = Number(detail.spuStockQuantity ?? 0) > 0
  maxSalePrice.value = Number.parseInt(`${detail.maxSalePrice ?? 0}`) || 0
  maxLinePrice.value = Number.parseInt(`${detail.maxLinePrice ?? 0}`) || 0
  minSalePrice.value = Number.parseInt(`${detail.minSalePrice ?? 0}`) || 0
  list.value = normalizePromotionList(activities)
  soldout.value = detail.isPutOnSale === 0
  soldNum.value = Number(detail.soldNum ?? 0)
}

function normalizeCommentItem(item: CommentItem): CommentViewItem {
  return {
    goodsSpu: item.spuId || '',
    userName: item.userName || '',
    commentScore: Number(item.commentScore ?? 0),
    commentContent: item.commentContent || '用户未填写评价',
    userHeadUrl: item.isAnonymity ? anonymousAvatar : item.userHeadUrl || anonymousAvatar,
  }
}

async function getCommentsList(nextSpuId: string) {
  try {
    const data = await getGoodsDetailsCommentList(nextSpuId)
    commentsList.value = (data.homePageComments || []).map(item => normalizeCommentItem(item as CommentItem))
  }
  catch (error) {
    console.error('comments error:', error)
  }
}

function normalizeCommentStatistics(data: GoodsDetailsCommentsCount): CommentStatistics {
  return {
    badCount: Number.parseInt(`${data.badCount}`),
    commentCount: Number.parseInt(`${data.commentCount}`),
    goodCount: Number.parseInt(`${data.goodCount}`),
    goodRate: Math.floor(Number(data.goodRate ?? 0) * 10) / 10,
    hasImageCount: Number.parseInt(`${data.hasImageCount}`),
    middleCount: Number.parseInt(`${data.middleCount}`),
  }
}

async function getCommentsStatistics(nextSpuId: string) {
  try {
    const data = await getGoodsDetailsCommentsCount(nextSpuId)
    commentsStatistics.value = normalizeCommentStatistics(data)
  }
  catch (error) {
    console.error('comments statistics error:', error)
  }
}

async function navToCommentsListPage() {
  await wpi.navigateTo({
    url: `/pages/goods/comments/index?spuId=${spuId.value}`,
  })
}

onShareAppMessage(() => {
  const shareSubTitle = selectedAttrStr.value.includes('件')
    ? selectedAttrStr.value.slice(selectedAttrStr.value.indexOf('件') + 1)
    : ''

  return {
    imageUrl: detailPrimaryImage.value,
    title: `${detailTitle.value}${shareSubTitle}`,
    path: `/pages/goods/details/index?spuId=${spuId.value}`,
  }
})

onLoad((query: { spuId?: string } = {}) => {
  spuId.value = query.spuId || ''
  if (!spuId.value) {
    return
  }
  void getDetail(spuId.value)
  void getCommentsList(spuId.value)
  void getCommentsStatistics(spuId.value)
})

definePageJson({
  navigationBarTitleText: '商品详情',
  usingComponents: {
    't-image': '/components/webp-image/index',
    't-tag': 'tdesign-miniprogram/tag/tag',
    't-rate': 'tdesign-miniprogram/rate/rate',
    't-swiper': 'tdesign-miniprogram/swiper/swiper',
    't-swiper-nav': 'tdesign-miniprogram/swiper-nav/swiper-nav',
    't-button': 'tdesign-miniprogram/button/button',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-popup': 'tdesign-miniprogram/popup/popup',
    'price': '/components/price/index',
    'buy-bar': './components/buy-bar/index',
    'promotion-popup': './components/promotion-popup/index',
    'goods-specs-popup': './components/goods-specs-popup/index',
  },
})
</script>

<template>
  <view class="goods-detail-page [&_.goods-info]:m-[0_auto] [&_.goods-info]:p-[26rpx_0_28rpx_30rpx] [&_.goods-info]:bg-white [&_.swipe-img]:w-full [&_.swipe-img]:h-[750rpx] [&_.goods-info_.goods-price]:flex [&_.goods-info_.goods-price]:items-baseline [&_.goods-info_.goods-price-up]:text-[#fa4126] [&_.goods-info_.goods-price-up]:text-[28rpx] [&_.goods-info_.goods-price-up]:relative [&_.goods-info_.goods-price-up]:bottom-[4rpx] [&_.goods-info_.goods-price-up]:left-[8rpx] [&_.goods-info_.goods-price_.class-goods-price]:text-[64rpx] [&_.goods-info_.goods-price_.class-goods-price]:text-[#fa4126] [&_.goods-info_.goods-price_.class-goods-price]:[font-weight:bold] [&_.goods-info_.goods-price_.class-goods-price]:font-[DIN_Alternate] [&_.goods-info_.goods-price_.class-goods-symbol]:text-[36rpx] [&_.goods-info_.goods-price_.class-goods-symbol]:text-[#fa4126] [&_.goods-info_.goods-price_.class-goods-del]:relative [&_.goods-info_.goods-price_.class-goods-del]:[font-weight:normal] [&_.goods-info_.goods-price_.class-goods-del]:left-[16rpx] [&_.goods-info_.goods-price_.class-goods-del]:bottom-[2rpx] [&_.goods-info_.goods-price_.class-goods-del]:text-[#999999] [&_.goods-info_.goods-price_.class-goods-del]:text-[32rpx] [&_.goods-info_.goods-number]:flex [&_.goods-info_.goods-number]:items-center [&_.goods-info_.goods-number]:justify-between [&_.goods-info_.goods-number_.sold-num]:text-[24rpx] [&_.goods-info_.goods-number_.sold-num]:text-[#999999] [&_.goods-info_.goods-number_.sold-num]:flex [&_.goods-info_.goods-number_.sold-num]:items-end [&_.goods-info_.goods-number_.sold-num]:mr-[32rpx] [&_.goods-info_.goods-activity]:flex [&_.goods-info_.goods-activity]:mt-[16rpx] [&_.goods-info_.goods-activity]:justify-between [&_.goods-info_.goods-activity_.tags-container]:flex [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[background:#ffece9] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:text-[#fa4126] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:text-[24rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:mr-[16rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:p-[4rpx_8rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:rounded-[4rpx] [&_.goods-info_.goods-activity_.activity-show]:flex [&_.goods-info_.goods-activity_.activity-show]:justify-center [&_.goods-info_.goods-activity_.activity-show]:items-center [&_.goods-info_.goods-activity_.activity-show]:text-[#fa4126] [&_.goods-info_.goods-activity_.activity-show]:text-[24rpx] [&_.goods-info_.goods-activity_.activity-show]:pr-[32rpx] [&_.goods-info_.goods-activity_.activity-show-text]:leading-[42rpx] [&_.goods-info_.goods-title]:flex [&_.goods-info_.goods-title]:justify-between [&_.goods-info_.goods-title]:items-center [&_.goods-info_.goods-title]:mt-[20rpx] [&_.goods-info_.goods-title_.goods-name]:w-[600rpx] [&_.goods-info_.goods-title_.goods-name]:font-medium [&_.goods-info_.goods-title_.goods-name]:[display:-webkit-box] [&_.goods-info_.goods-title_.goods-name]:[-webkit-box-orient:vertical] [&_.goods-info_.goods-title_.goods-name]:[-webkit-line-clamp:2] [&_.goods-info_.goods-title_.goods-name]:overflow-hidden [&_.goods-info_.goods-title_.goods-name]:text-[32rpx] [&_.goods-info_.goods-title_.goods-name]:break-all [&_.goods-info_.goods-title_.goods-name]:text-[#333333] [&_.goods-info_.goods-title_.goods-tag]:w-[104rpx] [&_.goods-info_.goods-title_.goods-tag]:ml-[26rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:rounded-[200rpx_0px_0px_200rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:w-[100rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:h-[96rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[border:none] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:pr-[36rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:text-[20rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:flex [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:flex-col [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:items-center [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:justify-center [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:h-[96rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:text-[#999] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:pt-[8rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:text-[20rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:leading-[24rpx] [&_.goods-info_.goods-intro]:text-[26rpx] [&_.goods-info_.goods-intro]:text-[#888] [&_.goods-info_.goods-intro]:leading-[36rpx] [&_.goods-info_.goods-intro]:break-all [&_.goods-info_.goods-intro]:pr-[30rpx] [&_.goods-info_.goods-intro]:[display:-webkit-box] [&_.goods-info_.goods-intro]:[-webkit-line-clamp:2] [&_.goods-info_.goods-intro]:[-webkit-box-orient:vertical] [&_.goods-info_.goods-intro]:whitespace-normal [&_.goods-info_.goods-intro]:overflow-hidden [&_.desc-content]:mt-[20rpx] [&_.desc-content]:bg-white [&_.desc-content]:pb-[120rpx] [&_.desc-content__title]:text-[28rpx] [&_.desc-content__title]:leading-[36rpx] [&_.desc-content__title]:text-center [&_.desc-content__title]:flex [&_.desc-content__title]:justify-center [&_.desc-content__title]:items-center [&_.desc-content__title]:p-[30rpx_20rpx] [&_.desc-content__title_.img]:w-[206rpx] [&_.desc-content__title_.img]:h-[10rpx] [&_.desc-content__title--text]:text-[26rpx] [&_.desc-content__title--text]:m-[0_32rpx] [&_.desc-content__title--text]:font-semibold [&_.desc-content__img]:w-full [&_.desc-content__img]:h-auto">
    <view class="goods-head">
      <t-swiper
        v-if="detailImages.length > 0"
        height="750rpx"
        :current="current"
        :autoplay="autoplay"
        :duration="duration"
        :interval="interval"
        :navigation="navigation"
        :list="detailImages"
      />
      <view class="goods-info">
        <view class="goods-number">
          <view class="goods-price">
            <price
              wr-class="class-goods-price"
              symbol-class="class-goods-symbol"
              :price="minSalePrice"
              type="lighter"
            />
            <view class="goods-price-up">
              起
            </view>
            <price wr-class="class-goods-del" :price="maxLinePrice" type="delthrough" />
          </view>
          <view class="sold-num">
            已售{{ soldNum }}
          </view>
        </view>
        <view v-if="activityList.length > 0" class="goods-activity" @tap="showPromotionPopup">
          <view class="tags-container">
            <view v-for="(item, index) in visibleActivityList" :key="index" :data-promotion-id="item.promotionId">
              <view class="goods-activity-tag">
                {{ item.tag }}
              </view>
            </view>
          </view>
          <view class="activity-show">
            <view class="activity-show-text">
              领劵
            </view>
            <t-icon name="chevron-right" size="42rpx" />
          </view>
        </view>
        <view class="goods-title">
          <view class="goods-name">
            {{ detailTitle }}
          </view>
          <view class="goods-tag">
            <t-button open-type="share" t-class="shareBtn" variant="text">
              <view class="btn-icon">
                <t-icon name="share" size="40rpx" color="#000" />
                <view class="share-text">
                  分享
                </view>
              </view>
            </t-button>
          </view>
        </view>
        <view class="goods-intro">
          {{ intro }}
        </view>
      </view>
      <view class="spu-select h-[80rpx] bg-white mt-[20rpx] flex items-center p-[30rpx] text-[28rpx] [&_.label]:mr-[30rpx] [&_.label]:text-center [&_.label]:shrink-0 [&_.label]:text-[#999999] [&_.label]:[font-weight:normal] [&_.content]:flex [&_.content]:flex-1 [&_.content]:justify-between [&_.content]:items-center [&_.content_.tintColor]:text-[#aaa]" @tap="showSkuSelectPopup">
        <view class="label">
          已选
        </view>
        <view class="content">
          <view :class="!selectedAttrStr ? 'tintColor' : ''">
            {{ selectedAttrStr ? buyNum : '' }}{{ selectedAttrStr || '请选择' }}
          </view>
          <t-icon name="chevron-right" size="40rpx" color="#BBBBBB" />
        </view>
      </view>
      <view v-if="commentsStatistics.commentCount > 0" class="comments-wrap mt-[20rpx] p-[32rpx] bg-white [&_.comments-head]:flex [&_.comments-head]:flex-row [&_.comments-head]:items-center [&_.comments-head]:justify-between [&_.comments-head_.comments-title-wrap]:flex">
        <view class="comments-head" @tap="navToCommentsListPage">
          <view class="comments-title-wrap">
            <view class="comments-title-label text-[#333333] text-[32rpx] font-medium leading-[48rpx]">
              商品评价
            </view>
            <view class="comments-title-count text-[#333333] text-[32rpx] font-medium leading-[48rpx]">
              ({{ commentsStatistics.commentCount }})
            </view>
          </view>
          <view class="comments-rate-wrap flex justify-center items-center text-[24rpx] [&_.comments-good-rate]:text-[#999999] [&_.comments-good-rate]:text-[26rpx] [&_.comments-good-rate]:font-normal [&_.comments-good-rate]:not-italic [&_.comments-good-rate]:leading-[36rpx]">
            <view class="comments-good-rate">
              {{ commentsStatistics.goodRate }}% 好评
            </view>
            <t-icon name="chevron-right" size="40rpx" color="#BBBBBB" />
          </view>
        </view>
        <view v-for="(commentItem, index) in commentsList" :key="commentItem.goodsSpu || index" class="comment-item-wrap [&_.comment-item-head]:flex [&_.comment-item-head]:flex-row [&_.comment-item-head]:items-center [&_.comment-item-head]:mt-[32rpx] [&_.comment-item-head_.comment-item-avatar]:w-[64rpx] [&_.comment-item-head_.comment-item-avatar]:h-[64rpx] [&_.comment-item-head_.comment-item-avatar]:rounded-[64rpx] [&_.comment-item-head_.comment-head-right]:ml-[24rpx] [&_.comment-item-content]:mt-[20rpx] [&_.comment-item-content]:text-[#333333] [&_.comment-item-content]:leading-[40rpx] [&_.comment-item-content]:text-[28rpx] [&_.comment-item-content]:font-normal">
          <view class="comment-item-head">
            <t-image :src="commentItem.userHeadUrl" t-class="comment-item-avatar" />
            <view class="comment-head-right [&_.comment-username]:text-[26rpx] [&_.comment-username]:text-[#333333] [&_.comment-username]:leading-[36rpx] [&_.comment-username]:font-normal">
              <view class="comment-username">
                {{ commentItem.userName }}
              </view>
              <t-rate
                :value="commentItem.commentScore"
                :count="5"
                size="12"
                gap="2"
                :color="['#ffc51c', '#ddd']"
              />
            </view>
          </view>
          <view class="comment-item-content">
            {{ commentItem.commentContent }}
          </view>
        </view>
      </view>
    </view>
    <view class="desc-content">
      <view v-if="detailDesc.length > 0" class="desc-content__title">
        <t-image t-class="img" :src="recLeftImg" />
        <text class="desc-content__title--text">详情介绍</text>
        <t-image t-class="img" :src="recRightImg" />
      </view>
      <view v-for="(item, index) in detailDesc" v-if="detailDesc.length > 0" :key="index">
        <t-image t-class="desc-content__img" :src="item" mode="widthFix" />
      </view>
    </view>
    <view class="goods-bottom-operation fixed left-0 bottom-0 w-full bg-white pb-[env(safe-area-inset-bottom)]">
      <buy-bar
        :jumpArray="jumpArray"
        :soldout="soldout"
        :isStock="isStock"
        :shopCartNum="cartNum"
        :buttonType="buttonType"
        class="goods-details-card"
        @toAddCart="toAddCart"
        @toNav="toNav"
        @toBuyNow="buyItNow"
      />
    </view>
    <goods-specs-popup
      id="goodsSpecsPopup"
      :show="isSpuSelectPopupShow"
      :title="detailTitle"
      :src="specImg || primaryImage"
      :specList="detailSpecList"
      :skuList="skuArray"
      :limitBuyInfo="detailLimitBuyInfo"
      :isStock="isStock"
      :outOperateStatus="outOperateStatus"
      @closeSpecsPopup="handlePopupHide"
      @change="chooseSpecItem"
      @changeNum="changeNum"
      @addCart="addCart"
      @buyNow="gotoBuy"
      @specsConfirm="specsConfirm"
    >
      <template #goods-price>
        <view>
          <view class="popup-sku__price">
            <price
              :price="selectSkuSellsPrice ? selectSkuSellsPrice : minSalePrice"
              wr-class="popup-sku__price-num"
              symbol-class="popup-sku__price-symbol"
            />
            <price
              v-if="selectSkuSellsPrice === 0 && minSalePrice !== maxSalePrice && !isAllSelectedSku"
              :price="maxSalePrice"
              wr-class="popup-sku__price-del"
              type="delthrough"
            />
          </view>
        </view>
      </template>
    </goods-specs-popup>
    <promotion-popup
      :list="list"
      :show="isShowPromotionPop"
      @closePromotionPopup="closePromotionPopup"
      @promotionChange="promotionChange"
    />
  </view>
</template>
