<script setup lang="ts">
import { onLoad, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { fetchPromotion } from '../../../services/promotion/detail'

const nativeInstance = useNativeInstance()

const list = ref<any[]>([])
const banner = ref('')
const time = ref(0)
const showBannerDesc = ref(false)
const statusTag = ref('')
const independentID = ref(`promotion-${Date.now()}`)
const useBannerDescSlot = ref(false)
const cdClass = ref('')

function countDownFinishHandle() {
  statusTag.value = 'finish'
  time.value = 0
}

function getGoodsList(promotionID: number) {
  fetchPromotion(promotionID).then(({
    list: goodsList,
    banner: nextBanner,
    time: nextTime,
    showBannerDesc: nextShowBannerDesc,
    statusTag: nextStatusTag,
  }: {
    list: any[]
    banner: string
    time: number
    showBannerDesc: boolean
    statusTag: string
  }) => {
    const goods = goodsList.map((item: any) => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags.map((v: any) => v.title) : [],
    }))
    list.value = goods
    banner.value = nextBanner
    time.value = nextTime
    showBannerDesc.value = nextShowBannerDesc
    statusTag.value = nextStatusTag
  })
}

async function goodClickHandle(e: any) {
  const index = Number(e?.detail?.index)
  if (!Number.isFinite(index) || index < 0) {
    return
  }
  const spuId = list.value[index]?.spuId
  if (spuId == null) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}`,
  })
}

function cardClickHandle() {
  showToast({
    context: nativeInstance,
    message: '点击加购',
  })
}

function bannerClickHandle() {
  showToast({
    context: nativeInstance,
    message: '点击规则详情',
  })
}

onLoad((query: Record<string, string>) => {
  const promotionID = Number.parseInt(query.promotion_id || '0', 10)
  getGoodsList(promotionID)
})

defineExpose({
  list,
  banner,
  time,
  showBannerDesc,
  statusTag,
  independentID,
  useBannerDescSlot,
  cdClass,
  countDownFinishHandle,
  goodClickHandle,
  cardClickHandle,
  bannerClickHandle,
})

definePageJson({
  navigationBarTitleText: '营销详情',
  usingComponents: {
    't-image': '/components/webp-image/index',
    't-icon': 'tdesign-miniprogram/icon/icon',
    'count-down': 'tdesign-miniprogram/count-down/count-down',
    'goods-list': '/components/goods-list/index',
  },
})
</script>

<template>
  <view id="js-page-wrap" class="promotion-detail-container [&_.wrap]:block [&_.wrap]:p-[0_24rpx] [&_.wrap]:[background:linear-gradient(#fff,#f5f5f5)] [&_.t-class-promotion-head]:w-[702rpx] [&_.t-class-promotion-head]:h-[160rpx] [&_.t-class-promotion-head]:rounded-[8rpx] [&_.wrap_.count-down-wrap]:flex [&_.wrap_.count-down-wrap]:flex-row [&_.wrap_.count-down-wrap]:justify-start [&_.wrap_.count-down-wrap]:items-baseline [&_.wrap_.count-down-wrap]:leading-[34rpx] [&_.wrap_.count-down-wrap_.in-banner-count-down-wrap]:absolute [&_.wrap_.count-down-wrap_.in-banner-count-down-wrap]:bottom-[32rpx] [&_.wrap_.count-down-wrap_.in-banner-count-down-wrap]:inset-x-[32rpx] [&_.wrap_.count-down-wrap_.status-tag]:h-[32rpx] [&_.wrap_.count-down-wrap_.status-tag]:leading-[32rpx] [&_.wrap_.count-down-wrap_.status-tag]:text-[20rpx] [&_.wrap_.count-down-wrap_.status-tag]:mr-[12rpx] [&_.wrap_.count-down-wrap_.status-tag]:rounded-[16rpx] [&_.wrap_.count-down-wrap_.status-tag]:p-[0_12rpx] [&_.wrap_.count-down-wrap_.status-tag_.before]:text-white [&_.wrap_.count-down-wrap_.status-tag_.before]:bg-[#ff9853] [&_.wrap_.count-down-wrap_.status-tag_.finish]:text-white [&_.wrap_.count-down-wrap_.status-tag_.finish]:bg-[#ccc] [&_.wrap_.count-down-wrap_.count-down-label]:text-[#666] [&_.wrap_.count-down-wrap_.count-down-label]:text-[24rpx] [&_.wrap_.count-down-wrap_.count-down-label]:mr-[0.5em] [&_.wrap_.count-down-wrap_.detail-entry]:ml-auto [&_.wrap_.count-down-wrap_.detail-entry]:h-[40rpx] [&_.wrap_.count-down-wrap_.detail-entry-label]:text-white [&_.wrap_.count-down-wrap_.detail-entry-label]:text-[24rpx] [&_.wrap_.count-down-wrap_.detail-entry-label]:mr-[12rpx] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap]:p-[10rpx] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry]:flex [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry]:items-center [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry-label]:text-[#999] [&_.wrap_.count-down-wrap_.after-banner-count-down-wrap_.detail-entry-label]:mr-0 [&_.wrap_.gl-empty-wrap]:mt-[180rpx] [&_.wrap_.gl-empty-img]:size-[240rpx] [&_.wrap_.gl-empty-img]:block [&_.wrap_.gl-empty-img]:m-[0_auto] [&_.wrap_.gl-empty-label]:text-[28rpx] [&_.wrap_.gl-empty-label]:text-[#999] [&_.wrap_.gl-empty-label]:mt-[40rpx] [&_.wrap_.gl-empty-label]:text-center [&_.goods-list-container]:[background:#f5f5f5] [&_.promotion-goods-list]:p-[20rpx_24rpx] [&_.promotion-goods-list]:bg-[#f5f5f5]">
    <view v-if="banner" :id="independentID" class="wrap">
      <view class="banner-wrap">
        <t-image :src="banner" mode="aspectFill" :webp="true" t-class="t-class-promotion-head" />
        <view
          v-if="!showBannerDesc && (time >= 0 || statusTag === 'finish')"
          class="count-down-wrap in-banner-count-down-wrap"
        >
          <block v-if="statusTag === 'finish'">
            <view :class="`status-tag ${statusTag}`">
              已结束
            </view>
            <text class="count-down-label">
              活动已结束
            </text>
          </block>
          <block v-else>
            <view v-if="statusTag === 'before'" :class="`status-tag ${statusTag}`">
              未开始
            </view>
            <text class="count-down-label">
              距结束仅剩
            </text>
            <count-down
              v-if="time > 0"
              t-class="wr-cd-class"
              :time="time"
              format="DD天 HH:mm:ss"
              @finish="countDownFinishHandle"
            />
          </block>
          <view class="detail-entry" @tap="bannerClickHandle">
            <text class="detail-entry-label">
              规则详情
            </text>
            <t-icon name="chevron-right" size="34rpx" style="color: #999" />
          </view>
        </view>
        <view
          v-if="showBannerDesc && (useBannerDescSlot || time >= 0 || statusTag === 'finish')"
          class="banner-desc-wrap"
        >
          <block v-if="useBannerDescSlot">
            <slot name="banner-desc" />
          </block>
          <block v-else>
            <view class="count-down-wrap after-banner-count-down-wrap">
              <block v-if="statusTag === 'finish'">
                <view :class="`status-tag ${statusTag}`">
                  已结束
                </view>
                <text class="count-down-label">
                  活动已结束
                </text>
              </block>
              <block v-else>
                <view v-if="statusTag === 'before'" :class="`status-tag ${statusTag}`">
                  未开始
                </view>
                <text class="count-down-label">
                  距结束仅剩
                </text>
                <count-down
                  v-if="time > 0"
                  :class="cdClass"
                  wr-class="wr-cd-class"
                  :time="time"
                  format="DD天 HH:mm:ss"
                  @finish="countDownFinishHandle"
                />
              </block>
              <view class="detail-entry" @tap="bannerClickHandle">
                <text class="detail-entry-label">
                  规则详情
                </text>
                <t-icon name="chevron-right" size="34rpx" style="color: #999" />
              </view>
            </view>
          </block>
        </view>
      </view>
    </view>
    <view v-if="list && list.length > 0" class="promotion-goods-list">
      <goods-list
        wr-class="goods-list-container"
        :goodsList="list"
        @click="goodClickHandle"
        @addcart="cardClickHandle"
      />
    </view>
  </view>
</template>
