<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, ref, watch } from 'wevu'
import { couponsData } from './mock'

interface PromotionGoodsItem {
  skuId?: string
  spuId?: string
  storeId?: string
  num?: number
  settlePrice?: string | number | null
}

interface OrderSureCouponItem {
  promotionId?: number | string
  storeId?: string
  couponId?: number | string
}

interface CouponResultItem {
  status: number
  couponVO: {
    couponId: number | string
    condition?: string
    endTime?: number
    name?: string
    promotionCode?: number | string
    startTime?: number
    value?: number
    type?: number
  }
}

interface CouponCardItem {
  key: number | string
  title: string
  isSelected: boolean
  timeLimit: string
  value: number
  status: 'useless' | 'default'
  desc: string
  type: number
  tag: string
  promotionId?: number | string
  storeId: string
  couponId: number | string
}

interface CouponQueryPayload {
  products: Array<{
    skuId?: string
    spuId?: string
    storeId?: string
    selected: true
    quantity: number
    prices: {
      sale: string | number | null | undefined
    }
  }>
  selectedCoupons: OrderSureCouponItem[]
  storeId: string
}

interface CouponResponse {
  couponResultList: CouponResultItem[]
  reduce: number
}

const props = withDefaults(defineProps<{
  storeId?: string
  promotionGoodsList?: PromotionGoodsItem[]
  orderSureCouponList?: OrderSureCouponItem[]
  couponsShow?: boolean
}>(), {
  storeId: '',
  promotionGoodsList: () => [],
  orderSureCouponList: () => [],
  couponsShow: false,
})

const emit = defineEmits<{
  sure: [payload: { selectedList: OrderSureCouponItem[] }]
}>()

const emptyCouponImg = `https://tdesign.gtimg.com/miniprogram/template/retail/coupon/ordersure-coupon-newempty.png`

const popupVisible = ref(false)
const couponsList = ref<CouponCardItem[]>([])
const selectedList = ref<OrderSureCouponItem[]>([])
const reduce = ref(0)
const selectedNum = computed(() => selectedList.value.length)

function buildProducts() {
  return props.promotionGoodsList.map(goods => ({
    skuId: goods.skuId,
    spuId: goods.spuId,
    storeId: goods.storeId,
    selected: true as const,
    quantity: goods.num || 0,
    prices: {
      sale: goods.settlePrice,
    },
  }))
}

function buildSelectedCoupons() {
  return props.orderSureCouponList.map(item => ({
    promotionId: item.promotionId,
    storeId: item.storeId,
    couponId: item.couponId,
  }))
}

function initData(data: CouponResponse) {
  const nextSelectedList: OrderSureCouponItem[] = []
  couponsList.value = (data.couponResultList || []).map((coupon) => {
    const { status, couponVO } = coupon
    const promotionId = couponVO.promotionCode
    const isSelected = status === 1
    if (isSelected) {
      nextSelectedList.push({
        couponId: couponVO.couponId,
        promotionId,
        storeId: props.storeId,
      })
    }
    return {
      key: couponVO.couponId,
      title: couponVO.name || '',
      isSelected,
      timeLimit: `${dayjs(Number(couponVO.startTime || 0)).format('YYYY-MM-DD')}-${dayjs(Number(couponVO.endTime || 0)).format('YYYY-MM-DD')}`,
      value: couponVO.type === 2 ? Number(couponVO.value || 0) / 100 : Number(couponVO.value || 0) / 10,
      status: status === -1 ? 'useless' : 'default',
      desc: couponVO.condition || '',
      type: couponVO.type || 0,
      tag: '',
      promotionId,
      storeId: props.storeId,
      couponId: couponVO.couponId,
    }
  })
  selectedList.value = nextSelectedList
  reduce.value = data.reduce || 0
}

async function coupons(_coupon: CouponQueryPayload): Promise<CouponResponse> {
  return Promise.resolve({
    couponResultList: couponsData.couponResultList as CouponResultItem[],
    reduce: couponsData.reduce,
  })
}

async function loadCoupons() {
  popupVisible.value = true
  const products = buildProducts()
  const selectedCoupons = buildSelectedCoupons()
  const res = await coupons({
    products,
    selectedCoupons,
    storeId: props.storeId,
  })
  initData(res)
}

function selectCoupon(e: { currentTarget?: { dataset?: { key?: number | string } } }) {
  const key = e.currentTarget?.dataset?.key
  couponsList.value = couponsList.value.map((coupon) => {
    if (coupon.key !== key) {
      return coupon
    }
    return {
      ...coupon,
      isSelected: !coupon.isSelected,
    }
  })

  selectedList.value = couponsList.value
    .filter(coupon => coupon.isSelected)
    .map(coupon => ({
      couponId: coupon.couponId,
      promotionId: coupon.promotionId,
      storeId: coupon.storeId,
    }))

  emit('sure', {
    selectedList: selectedList.value,
  })
}

function hide() {
  popupVisible.value = false
}

watch(() => props.couponsShow, (visible) => {
  if (visible) {
    void loadCoupons()
    return
  }
  popupVisible.value = false
}, {
  immediate: true,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-image': '/components/webp-image/index',
    'wr-price': '/components/price/index',
    'coupon-card': '/components/promotion/ui-coupon-card/index',
  },
})
</script>

<template>
  <t-popup :visible="popupVisible" placement="bottom" @visible-change="hide">
    <view class="select-coupons [background:#fff] [width:100%] [position:relative] [border-radius:20rpx_20rpx_0_0] [padding-top:28rpx] [padding-bottom:env(safe-area-inset-bottom)] [&_.title]:[width:100%] [&_.title]:[text-align:center] [&_.title]:[font-size:32rpx] [&_.title]:[color:#333] [&_.title]:[font-weight:600] [&_.title]:[line-height:44rpx] [&_.info]:[width:100%] [&_.info]:[height:34rpx] [&_.info]:[font-size:24rpx] [&_.info]:[color:#999] [&_.info]:[line-height:34rpx] [&_.info]:[margin:20rpx_0] [&_.info]:[padding:0_20rpx] [&_.info_.price]:[color:#fa4126] [&_.coupons-list]:[max-height:500rpx] [&_.coupons-list_.coupons-wrap]:[padding:0rpx_20rpx] [&_.coupons-list_.disable]:[font-size:24rpx] [&_.coupons-list_.disable]:[color:#ff2525] [&_.coupons-list_.disable]:[padding-top:20rpx] [&_.coupons-list_.slot-radio]:[position:absolute] [&_.coupons-list_.slot-radio]:[right:22rpx] [&_.coupons-list_.slot-radio]:[top:50%] [&_.coupons-list_.slot-radio]:[transform:translateY(-50%)] [&_.coupons-list_.slot-radio]:[display:inline-block] [&_.coupons-list_.slot-radio_.wr-check-filled]:[font-size:36rpx] [&_.coupons-list_.slot-radio_.check]:[width:36rpx] [&_.coupons-list_.slot-radio_.text-primary]:[color:#fa4126] [&_.coupons-list_.slot-radio_.wr-check]:[font-size:36rpx] [&_.coupons-list_.slot-radio_.wr-uncheck]:[font-size:36rpx] [&_.coupons-list_.slot-radio_.wr-uncheck]:[color:#999] [&_.couponp-empty-wrap]:[padding:40rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:[display:block] [&_.couponp-empty-wrap_.couponp-empty-img]:[width:240rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:[height:240rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:[margin:0_auto] [&_.couponp-empty-wrap_.couponp-empty-title]:[font-size:28rpx] [&_.couponp-empty-wrap_.couponp-empty-title]:[color:#999] [&_.couponp-empty-wrap_.couponp-empty-title]:[text-align:center] [&_.couponp-empty-wrap_.couponp-empty-title]:[line-height:40rpx] [&_.couponp-empty-wrap_.couponp-empty-title]:[margin-top:40rpx] [&_.coupons-cover]:[height:112rpx] [&_.coupons-cover]:[width:100%] [&_.coupons-cover]:[box-sizing:border-box] [&_.coupons-cover]:[margin-top:30rpx] [&_.coupons-cover]:[padding:12rpx_32rpx] [&_.coupons-cover]:[display:flex] [&_.coupons-cover]:[justify-content:space-between] [&_.coupons-cover]:[align-items:center] [&_.coupons-cover_.btn]:[width:332rpx] [&_.coupons-cover_.btn]:[height:88rpx] [&_.coupons-cover_.btn]:[text-align:center] [&_.coupons-cover_.btn]:[line-height:88rpx] [&_.coupons-cover_.btn]:[font-size:32rpx] [&_.coupons-cover_.btn]:[border-radius:44rpx] [&_.coupons-cover_.btn]:[box-sizing:border-box] [&_.coupons-cover_.btn]:[border:2rpx_solid_#dddddd] [&_.coupons-cover_.btn]:[color:#333333] [&_.coupons-cover_.red]:[border-color:#fa4126] [&_.coupons-cover_.red]:[background-color:#fa4126] [&_.coupons-cover_.red]:[color:#ffffff]">
      <view class="title">
        选择优惠券
      </view>
      <block v-if="couponsList.length > 0">
        <view class="info">
          <block v-if="!selectedNum">
            你有{{ couponsList.length }}张可用优惠券
          </block>
          <block v-else>
            已选中{{ selectedNum }}张推荐优惠券, 共抵扣
            <wr-price :fill="false" :price="reduce || 0" />
          </block>
        </view>
        <scroll-view class="coupons-list" scroll-y="true">
          <view class="coupons-wrap">
            <block v-for="(coupon, index) in couponsList" :key="index">
              <coupon-card
                :title="coupon.title"
                :type="coupon.type"
                :status="coupon.status"
                :desc="coupon.desc"
                :value="coupon.value"
                :tag="coupon.tag"
                :timeLimit="coupon.timeLimit"
              >
                <template #operator>
                  <view class="slot-radio">
                    <t-icon :data-key="coupon.key" :name="coupon.isSelected ? 'check-circle-filled' : 'circle'" color="#fa4126" size="40rpx" @tap="selectCoupon" />
                  </view>
                </template>
              </coupon-card>
              <view v-if="coupon.status == 'useless'" class="disable">
                此优惠券不能和已勾选的优惠券叠加使用
              </view>
            </block>
          </view>
        </scroll-view>
      </block>
      <view v-else class="couponp-empty-wrap">
        <t-image t-class="couponp-empty-img" :src="emptyCouponImg" />
        <view class="couponp-empty-title">
          暂无优惠券
        </view>
      </view>
      <view class="coupons-cover" />
    </view>
  </t-popup>
</template>
