<script setup lang="ts">
import type { RightsListParams, RightsListResult } from './api'
import { onLoad, onPageScroll, onReachBottom, onShow, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { AfterServiceStatus, ServiceType, ServiceTypeDesc } from '../config'
import { getRightsList } from './api'

interface TabItem {
  key: number
  text: string
  info?: number
}

type RightsListItem = RightsListResult['data']['dataList'][number]

interface AfterServiceGoodsItem {
  id: number
  thumb: string
  title: string
  specs: string[]
  itemRefundAmount: number
  rightsQuantity: number
}

interface AfterServiceListItem {
  id: string
  serviceNo: string
  storeName: string
  type: number
  typeDesc: string
  typeDescIcon: string
  status: number
  statusName: string
  statusDesc: string
  amount: number
  goodsList: AfterServiceGoodsItem[]
  storeId: string
  buttons: RightsListItem['buttonVOs']
  logisticsNo: string
  logisticsCompanyName: string
  logisticsCompanyCode: string
  remark: string | null
  logisticsVO: any
}

const nativeInstance = useNativeInstance()
const page = {
  size: 10,
  num: 1,
}

const tabs = ref<TabItem[]>([
  {
    key: -1,
    text: '全部',
  },
  {
    key: AfterServiceStatus.TO_AUDIT,
    text: '待审核',
  },
  {
    key: AfterServiceStatus.THE_APPROVED,
    text: '已审核',
  },
  {
    key: AfterServiceStatus.COMPLETE,
    text: '已完成',
  },
  {
    key: AfterServiceStatus.CLOSED,
    text: '已关闭',
  },
])
const curTab = ref(-1)
const dataList = ref<AfterServiceListItem[]>([])
const listLoading = ref(0)
const pullDownRefreshing = ref(false)
const emptyImg = ref('https://tdesign.gtimg.com/miniprogram/template/retail/order/empty-order-list.png')
const backRefresh = ref(false)
const pullDownRefresh = ref<any>(null)

function normalizeStatus(status?: string) {
  const parsedStatus = Number.parseInt(status || '-1', 10)
  return tabs.value.map(tab => tab.key).includes(parsedStatus) ? parsedStatus : -1
}

function normalizeTabs(states: RightsListResult['data']['states']) {
  tabs.value = tabs.value.map((item) => {
    switch (item.key) {
      case AfterServiceStatus.TO_AUDIT:
        return { ...item, info: states.audit }
      case AfterServiceStatus.THE_APPROVED:
        return { ...item, info: states.approved }
      case AfterServiceStatus.COMPLETE:
        return { ...item, info: states.complete }
      case AfterServiceStatus.CLOSED:
        return { ...item, info: states.closed }
      default:
        return item
    }
  })
}

function normalizeDataList(source: RightsListResult['data']['dataList']): AfterServiceListItem[] {
  return source.map((_data) => {
    return {
      id: _data.rights.rightsNo,
      serviceNo: _data.rights.rightsNo,
      storeName: _data.rights.storeName,
      type: _data.rights.rightsType,
      typeDesc: ServiceTypeDesc[_data.rights.rightsType],
      typeDescIcon: _data.rights.rightsType === ServiceType.ONLY_REFUND ? 'money-circle' : 'return-goods-1',
      status: _data.rights.rightsStatus,
      statusName: _data.rights.userRightsStatusName,
      statusDesc: _data.rights.userRightsStatusDesc,
      amount: _data.rights.refundAmount,
      goodsList: (_data.rightsItem || []).map((item, index) => ({
        id: index,
        thumb: item.goodsPictureUrl,
        title: item.goodsName,
        specs: (item.specInfo || []).map(spec => spec.specValues || ''),
        itemRefundAmount: item.itemRefundAmount,
        rightsQuantity: item.rightsQuantity,
      })),
      storeId: _data.storeId,
      buttons: _data.buttonVOs || [],
      logisticsNo: _data.logisticsVO.logisticsNo,
      logisticsCompanyName: _data.logisticsVO.logisticsCompanyName,
      logisticsCompanyCode: _data.logisticsVO.logisticsCompanyCode,
      remark: _data.logisticsVO.remark,
      logisticsVO: _data.logisticsVO,
    } as AfterServiceListItem
  })
}

async function getAfterServiceList(statusCode = -1, reset = false) {
  const params: RightsListParams = {
    parameter: {
      pageSize: page.size,
      pageNum: page.num,
      ...(statusCode !== -1 ? { afterServiceStatus: statusCode } : {}),
    },
  }

  listLoading.value = 1

  try {
    const res = await getRightsList(params)
    page.num += 1
    normalizeTabs(res.data.states)
    const nextDataList = normalizeDataList(res.data.dataList || [])
    dataList.value = reset ? nextDataList : dataList.value.concat(nextDataList)
    listLoading.value = nextDataList.length > 0 ? 0 : 2
  }
  catch (error) {
    listLoading.value = 3
    throw error
  }
}

async function refreshList(status = -1) {
  page.num = 1
  curTab.value = status
  dataList.value = []
  await getAfterServiceList(status, true)
}

function init(status?: number) {
  void refreshList(status ?? curTab.value)
}

async function onPullDownRefresh_(e: { detail?: { callback?: () => void } }) {
  pullDownRefreshing.value = true
  try {
    await refreshList(curTab.value)
  }
  finally {
    pullDownRefreshing.value = false
    e.detail?.callback?.()
  }
}

function onReTryLoad() {
  void getAfterServiceList(curTab.value)
}

function onRefresh() {
  void refreshList(curTab.value)
}

async function onAfterServiceCardTap(e: { currentTarget?: { dataset?: { order?: AfterServiceListItem } } }) {
  const order = e.currentTarget?.dataset?.order
  if (!order) {
    return
  }
  await wpi.navigateTo({
    url: `/pages/order/after-service-detail/index?rightsNo=${order.id}`,
  })
}

onLoad((query: { status?: string } = {}) => {
  init(normalizeStatus(query.status))
  pullDownRefresh.value = nativeInstance.selectComponent?.('#t-pull-down-refresh') ?? null
})

onShow(() => {
  if (!backRefresh.value) {
    return
  }
  onRefresh()
  backRefresh.value = false
})

onReachBottom(() => {
  if (listLoading.value === 0) {
    void getAfterServiceList(curTab.value)
  }
})

onPageScroll((e) => {
  pullDownRefresh.value?.onPageScroll?.(e)
})

definePageJson({
  navigationBarTitleText: '退款/售后',
  usingComponents: {
    'wr-load-more': '/components/load-more/index',
    'wr-after-service-button-bar': '../components/after-service-button-bar/index',
    'wr-price': '/components/price/index',
    'wr-order-card': '../components/order-card/index',
    'wr-goods-card': '../components/goods-card/index',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-empty': 'tdesign-miniprogram/empty/empty',
    't-pull-down-refresh': 'tdesign-miniprogram/pull-down-refresh/pull-down-refresh',
  },
})
</script>

<template>
  <view class="page-container [&_.order-goods-card-footer]:[display:flex] [&_.order-goods-card-footer]:[width:calc(100%_-_190rpx)] [&_.order-goods-card-footer]:[justify-content:space-between] [&_.order-goods-card-footer]:[position:absolute] [&_.order-goods-card-footer]:[bottom:20rpx] [&_.order-goods-card-footer]:[left:190rpx] [&_.order-goods-card-footer_.order-goods-card-footer-num]:[color:#999] [&_.order-goods-card-footer_.order-goods-card-footer-num]:[line-height:40rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-size:36rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-class]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-size:28rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-decimal]:[font-family:DIN_Alternate] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[color:#333] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-size:24rpx] [&_.order-goods-card-footer_.order-goods-card-footer-price-symbol]:[font-family:DIN_Alternate] [&_.wr-goods-card__specs]:[margin:14rpx_20rpx_0_0] [&_.order-card_.header_.store-name]:[width:80%] [&_.order-card_.header_.store-name]:[-webkit-line-clamp:1] [&_.status-desc]:[box-sizing:border-box] [&_.status-desc]:[padding:22rpx_20rpx] [&_.status-desc]:[font-size:26rpx] [&_.status-desc]:[line-height:1.3] [&_.status-desc]:[text-align:left] [&_.status-desc]:[color:#333333] [&_.status-desc]:[background-color:#f5f5f5] [&_.status-desc]:[border-radius:8rpx] [&_.status-desc]:[word-wrap:break-word] [&_.status-desc]:[margin-top:24rpx] [&_.status-desc]:[margin-bottom:20rpx] [&_.header__right]:[font-size:24rpx] [&_.header__right]:[color:#fa4126] [&_.header__right]:[display:flex] [&_.header__right]:[align-items:center] [&_.header__right__icon]:[color:#d05b27] [&_.header__right__icon]:[font-size:16px] [&_.header__right__icon]:[margin-right:10rpx] [&_.header-class]:[margin-bottom:5rpx]">
    <t-pull-down-refresh id="t-pull-down-refresh" t-class-indicator="t-class-indicator" @refresh="onPullDownRefresh_">
      <wr-order-card
        v-for="order in dataList"
        :key="order.id"
        :order="order"
        :data-order="order"
        useTopRightSlot
        header-class="header-class"
        @cardtap="onAfterServiceCardTap"
      >
        <template #top-right>
          <view class="text-btn">
            <view class="header__right">
              <template #left-icon>
                <t-icon prefix="wr" color="#FA4126" name="goods_refund" size="20px" />
              </template>
              {{ order.typeDesc }}
            </view>
          </view>
        </template>
        <wr-goods-card
          v-for="(goods, gIndex) in order.goodsList"
          :key="goods.id"
          :data="goods"
          :no-top-line="gIndex === 0"
        >
          <template #footer>
            <view class="order-goods-card-footer">
              <wr-price
                :price="goods.itemRefundAmount"
                fill
                wr-class="order-goods-card-footer-price-class"
                symbol-class="order-goods-card-footer-price-symbol"
                decimal-class="order-goods-card-footer-price-decimal"
              />
              <view class="order-goods-card-footer-num">
                x {{ goods.rightsQuantity }}
              </view>
            </view>
          </template>
        </wr-goods-card>
        <template #more>
          <view>
            <view class="status-desc">
              {{ order.statusDesc }}
            </view>
            <wr-after-service-button-bar :service="order" @refresh="onRefresh" />
          </view>
        </template>
      </wr-order-card>
      <!-- 列表加载中/已全部加载 -->
      <wr-load-more
        v-if="!pullDownRefreshing"
        :list-is-empty="!dataList.length"
        :status="listLoading"
        @retry="onReTryLoad"
      >
        <!-- 空态 -->
        <template #empty>
          <view class="empty-wrapper [height:calc(100vh_-_88rpx)]">
            <t-empty size="240rpx" textColor="#999999" textSize="28rpx" :src="emptyImg">
              暂无退款或售后申请记录
            </t-empty>
          </view>
        </template>
      </wr-load-more>
    </t-pull-down-refresh>
  </view>
</template>
