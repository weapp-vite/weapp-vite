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
  <view class="goods-detail-page [&_.goods-info]:[margin:0_auto] [&_.goods-info]:[padding:26rpx_0_28rpx_30rpx] [&_.goods-info]:[background-color:#fff] [&_.swipe-img]:[width:100%] [&_.swipe-img]:[height:750rpx] [&_.goods-info_.goods-price]:[display:flex] [&_.goods-info_.goods-price]:[align-items:baseline] [&_.goods-info_.goods-price-up]:[color:#fa4126] [&_.goods-info_.goods-price-up]:[font-size:28rpx] [&_.goods-info_.goods-price-up]:[position:relative] [&_.goods-info_.goods-price-up]:[bottom:4rpx] [&_.goods-info_.goods-price-up]:[left:8rpx] [&_.goods-info_.goods-price_.class-goods-price]:[font-size:64rpx] [&_.goods-info_.goods-price_.class-goods-price]:[color:#fa4126] [&_.goods-info_.goods-price_.class-goods-price]:[font-weight:bold] [&_.goods-info_.goods-price_.class-goods-price]:[font-family:DIN_Alternate] [&_.goods-info_.goods-price_.class-goods-symbol]:[font-size:36rpx] [&_.goods-info_.goods-price_.class-goods-symbol]:[color:#fa4126] [&_.goods-info_.goods-price_.class-goods-del]:[position:relative] [&_.goods-info_.goods-price_.class-goods-del]:[font-weight:normal] [&_.goods-info_.goods-price_.class-goods-del]:[left:16rpx] [&_.goods-info_.goods-price_.class-goods-del]:[bottom:2rpx] [&_.goods-info_.goods-price_.class-goods-del]:[color:#999999] [&_.goods-info_.goods-price_.class-goods-del]:[font-size:32rpx] [&_.goods-info_.goods-number]:[display:flex] [&_.goods-info_.goods-number]:[align-items:center] [&_.goods-info_.goods-number]:[justify-content:space-between] [&_.goods-info_.goods-number_.sold-num]:[font-size:24rpx] [&_.goods-info_.goods-number_.sold-num]:[color:#999999] [&_.goods-info_.goods-number_.sold-num]:[display:flex] [&_.goods-info_.goods-number_.sold-num]:[align-items:flex-end] [&_.goods-info_.goods-number_.sold-num]:[margin-right:32rpx] [&_.goods-info_.goods-activity]:[display:flex] [&_.goods-info_.goods-activity]:[margin-top:16rpx] [&_.goods-info_.goods-activity]:[justify-content:space-between] [&_.goods-info_.goods-activity_.tags-container]:[display:flex] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[background:#ffece9] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[color:#fa4126] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[font-size:24rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[margin-right:16rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[padding:4rpx_8rpx] [&_.goods-info_.goods-activity_.tags-container_.goods-activity-tag]:[border-radius:4rpx] [&_.goods-info_.goods-activity_.activity-show]:[display:flex] [&_.goods-info_.goods-activity_.activity-show]:[justify-content:center] [&_.goods-info_.goods-activity_.activity-show]:[align-items:center] [&_.goods-info_.goods-activity_.activity-show]:[color:#fa4126] [&_.goods-info_.goods-activity_.activity-show]:[font-size:24rpx] [&_.goods-info_.goods-activity_.activity-show]:[padding-right:32rpx] [&_.goods-info_.goods-activity_.activity-show-text]:[line-height:42rpx] [&_.goods-info_.goods-title]:[display:flex] [&_.goods-info_.goods-title]:[justify-content:space-between] [&_.goods-info_.goods-title]:[align-items:center] [&_.goods-info_.goods-title]:[margin-top:20rpx] [&_.goods-info_.goods-title_.goods-name]:[width:600rpx] [&_.goods-info_.goods-title_.goods-name]:[font-weight:500] [&_.goods-info_.goods-title_.goods-name]:[display:-webkit-box] [&_.goods-info_.goods-title_.goods-name]:[-webkit-box-orient:vertical] [&_.goods-info_.goods-title_.goods-name]:[-webkit-line-clamp:2] [&_.goods-info_.goods-title_.goods-name]:[overflow:hidden] [&_.goods-info_.goods-title_.goods-name]:[font-size:32rpx] [&_.goods-info_.goods-title_.goods-name]:[word-break:break-all] [&_.goods-info_.goods-title_.goods-name]:[color:#333333] [&_.goods-info_.goods-title_.goods-tag]:[width:104rpx] [&_.goods-info_.goods-title_.goods-tag]:[margin-left:26rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[border-radius:200rpx_0px_0px_200rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[width:100rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[height:96rpx] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[border:none] [&_.goods-info_.goods-title_.goods-tag_.shareBtn]:[padding-right:36rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[font-size:20rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[display:flex] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[flex-direction:column] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[align-items:center] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[justify-content:center] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[height:96rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon]:[color:#999] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:[padding-top:8rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:[font-size:20rpx] [&_.goods-info_.goods-title_.goods-tag_.btn-icon_.share-text]:[line-height:24rpx] [&_.goods-info_.goods-intro]:[font-size:26rpx] [&_.goods-info_.goods-intro]:[color:#888] [&_.goods-info_.goods-intro]:[line-height:36rpx] [&_.goods-info_.goods-intro]:[word-break:break-all] [&_.goods-info_.goods-intro]:[padding-right:30rpx] [&_.goods-info_.goods-intro]:[display:-webkit-box] [&_.goods-info_.goods-intro]:[-webkit-line-clamp:2] [&_.goods-info_.goods-intro]:[-webkit-box-orient:vertical] [&_.goods-info_.goods-intro]:[white-space:normal] [&_.goods-info_.goods-intro]:[overflow:hidden] [&_.desc-content]:[margin-top:20rpx] [&_.desc-content]:[background-color:#fff] [&_.desc-content]:[padding-bottom:120rpx] [&_.desc-content__title]:[font-size:28rpx] [&_.desc-content__title]:[line-height:36rpx] [&_.desc-content__title]:[text-align:center] [&_.desc-content__title]:[display:flex] [&_.desc-content__title]:[justify-content:center] [&_.desc-content__title]:[align-items:center] [&_.desc-content__title]:[padding:30rpx_20rpx] [&_.desc-content__title_.img]:[width:206rpx] [&_.desc-content__title_.img]:[height:10rpx] [&_.desc-content__title--text]:[font-size:26rpx] [&_.desc-content__title--text]:[margin:0_32rpx] [&_.desc-content__title--text]:[font-weight:600] [&_.desc-content__img]:[width:100%] [&_.desc-content__img]:[height:auto]">
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
      <view class="spu-select [height:80rpx] [background-color:#fff] [margin-top:20rpx] [display:flex] [align-items:center] [padding:30rpx] [font-size:28rpx] [&_.label]:[margin-right:30rpx] [&_.label]:[text-align:center] [&_.label]:[flex-shrink:0] [&_.label]:[color:#999999] [&_.label]:[font-weight:normal] [&_.content]:[display:flex] [&_.content]:[flex:1] [&_.content]:[justify-content:space-between] [&_.content]:[align-items:center] [&_.content_.tintColor]:[color:#aaa]" @tap="showSkuSelectPopup">
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
      <view v-if="commentsStatistics.commentCount > 0" class="comments-wrap [margin-top:20rpx] [padding:32rpx] [background-color:#fff] [&_.comments-head]:[display:flex] [&_.comments-head]:[flex-direction:row] [&_.comments-head]:[align-items:center] [&_.comments-head]:[justify-content:space-between] [&_.comments-head_.comments-title-wrap]:[display:flex]">
        <view class="comments-head" @tap="navToCommentsListPage">
          <view class="comments-title-wrap">
            <view class="comments-title-label [color:#333333] [font-size:32rpx] [font-weight:500] [line-height:48rpx]">
              商品评价
            </view>
            <view class="comments-title-count [color:#333333] [font-size:32rpx] [font-weight:500] [line-height:48rpx]">
              ({{ commentsStatistics.commentCount }})
            </view>
          </view>
          <view class="comments-rate-wrap [display:flex] [justify-content:center] [align-items:center] [font-size:24rpx] [&_.comments-good-rate]:[color:#999999] [&_.comments-good-rate]:[font-size:26rpx] [&_.comments-good-rate]:[font-weight:400] [&_.comments-good-rate]:[font-style:normal] [&_.comments-good-rate]:[line-height:36rpx]">
            <view class="comments-good-rate">
              {{ commentsStatistics.goodRate }}% 好评
            </view>
            <t-icon name="chevron-right" size="40rpx" color="#BBBBBB" />
          </view>
        </view>
        <view v-for="(commentItem, index) in commentsList" :key="commentItem.goodsSpu || index" class="comment-item-wrap [&_.comment-item-head]:[display:flex] [&_.comment-item-head]:[flex-direction:row] [&_.comment-item-head]:[align-items:center] [&_.comment-item-head]:[margin-top:32rpx] [&_.comment-item-head_.comment-item-avatar]:[width:64rpx] [&_.comment-item-head_.comment-item-avatar]:[height:64rpx] [&_.comment-item-head_.comment-item-avatar]:[border-radius:64rpx] [&_.comment-item-head_.comment-head-right]:[margin-left:24rpx] [&_.comment-item-content]:[margin-top:20rpx] [&_.comment-item-content]:[color:#333333] [&_.comment-item-content]:[line-height:40rpx] [&_.comment-item-content]:[font-size:28rpx] [&_.comment-item-content]:[font-weight:400]">
          <view class="comment-item-head">
            <t-image :src="commentItem.userHeadUrl" t-class="comment-item-avatar" />
            <view class="comment-head-right [&_.comment-username]:[font-size:26rpx] [&_.comment-username]:[color:#333333] [&_.comment-username]:[line-height:36rpx] [&_.comment-username]:[font-weight:400]">
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
    <view class="goods-bottom-operation [position:fixed] [left:0] [bottom:0] [width:100%] [background-color:#fff] [padding-bottom:env(safe-area-inset-bottom)]">
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
