<script setup lang="ts">
import { computed, ref, watch } from 'wevu'
import { formatTime } from '../../../../utils/util'
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
      timeLimit: `${formatTime(Number(couponVO.startTime || 0), 'YYYY-MM-DD')}-${formatTime(Number(couponVO.endTime || 0), 'YYYY-MM-DD')}`,
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
    <view class="select-coupons [background:#fff] w-full relative rounded-[20rpx_20rpx_0_0] pt-[28rpx] pb-[env(safe-area-inset-bottom)] [&_.title]:w-full [&_.title]:text-center [&_.title]:text-[32rpx] [&_.title]:text-[#333] [&_.title]:font-semibold [&_.title]:leading-[44rpx] [&_.info]:w-full [&_.info]:h-[34rpx] [&_.info]:text-[24rpx] [&_.info]:text-[#999] [&_.info]:leading-[34rpx] [&_.info]:m-[20rpx_0] [&_.info]:p-[0_20rpx] [&_.info_.price]:text-[#fa4126] [&_.coupons-list]:max-h-[500rpx] [&_.coupons-list_.coupons-wrap]:p-[0rpx_20rpx] [&_.coupons-list_.disable]:text-[24rpx] [&_.coupons-list_.disable]:text-[#ff2525] [&_.coupons-list_.disable]:pt-[20rpx] [&_.coupons-list_.slot-radio]:absolute [&_.coupons-list_.slot-radio]:right-[22rpx] [&_.coupons-list_.slot-radio]:top-[50%] [&_.coupons-list_.slot-radio]:transform-[translateY(-50%)] [&_.coupons-list_.slot-radio]:inline-block [&_.coupons-list_.slot-radio_.wr-check-filled]:text-[36rpx] [&_.coupons-list_.slot-radio_.check]:w-[36rpx] [&_.coupons-list_.slot-radio_.text-primary]:text-[#fa4126] [&_.coupons-list_.slot-radio_.wr-check]:text-[36rpx] [&_.coupons-list_.slot-radio_.wr-uncheck]:text-[36rpx] [&_.coupons-list_.slot-radio_.wr-uncheck]:text-[#999] [&_.couponp-empty-wrap]:p-[40rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:block [&_.couponp-empty-wrap_.couponp-empty-img]:w-[240rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:h-[240rpx] [&_.couponp-empty-wrap_.couponp-empty-img]:m-[0_auto] [&_.couponp-empty-wrap_.couponp-empty-title]:text-[28rpx] [&_.couponp-empty-wrap_.couponp-empty-title]:text-[#999] [&_.couponp-empty-wrap_.couponp-empty-title]:text-center [&_.couponp-empty-wrap_.couponp-empty-title]:leading-[40rpx] [&_.couponp-empty-wrap_.couponp-empty-title]:mt-[40rpx] [&_.coupons-cover]:h-[112rpx] [&_.coupons-cover]:w-full [&_.coupons-cover]:box-border [&_.coupons-cover]:mt-[30rpx] [&_.coupons-cover]:p-[12rpx_32rpx] [&_.coupons-cover]:flex [&_.coupons-cover]:justify-between [&_.coupons-cover]:items-center [&_.coupons-cover_.btn]:w-[332rpx] [&_.coupons-cover_.btn]:h-[88rpx] [&_.coupons-cover_.btn]:text-center [&_.coupons-cover_.btn]:leading-[88rpx] [&_.coupons-cover_.btn]:text-[32rpx] [&_.coupons-cover_.btn]:rounded-[44rpx] [&_.coupons-cover_.btn]:box-border [&_.coupons-cover_.btn]:[border:2rpx_solid_#dddddd] [&_.coupons-cover_.btn]:text-[#333333] [&_.coupons-cover_.red]:border-[#fa4126] [&_.coupons-cover_.red]:bg-[#fa4126] [&_.coupons-cover_.red]:text-[#ffffff]">
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
