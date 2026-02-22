<script setup lang="ts">
import { onLoad, onShow, reactive, ref, useNativeInstance } from 'wevu'
import Dialog from 'tdesign-miniprogram/dialog/index'
import Toast from 'tdesign-miniprogram/toast/index'
import { fetchCartGroupData } from '../../services/cart/cart'

type CartGroupData = Record<string, any>

const nativeInstance = useNativeInstance() as any
const cartGroupData = reactive<CartGroupData>({
  storeGoods: [],
  invalidGoodItems: [],
  isNotEmpty: false,
  isAllSelected: false,
  selectedGoodsCount: 0,
  totalAmount: '',
  totalDiscountAmount: '',
})
const cartStoreGoods = ref<any[]>([])
const cartInvalidGoodItems = ref<any[]>([])
const cartIsNotEmpty = ref(false)
const cartIsAllSelected = ref(false)
const cartSelectedGoodsCount = ref(0)
const cartTotalAmount = ref('')
const cartTotalDiscountAmount = ref('')
let hasRequestedInitialData = false
let hasLoadedCartData = false

function refreshData() {
  getCartGroupData().then((res: any) => {
    let isEmpty = true
    const nextCartGroupData = (res?.data || {}) as CartGroupData
    const storeGoods = Array.isArray(nextCartGroupData.storeGoods) ? nextCartGroupData.storeGoods : []
    const invalidGoodItems = Array.isArray(nextCartGroupData.invalidGoodItems) ? nextCartGroupData.invalidGoodItems : []

    // 一些组件中需要的字段可能接口并没有返回，或者返回的数据结构与预期不一致，需要在此先对数据做一些处理
    // 统计门店下加购的商品是否全选、是否存在缺货/无货
    for (const store of storeGoods) {
      store.isSelected = true // 该门店已加购商品是否全选
      store.storeStockShortage = false // 该门店已加购商品是否存在库存不足
      if (!Array.isArray(store.shortageGoodsList)) {
        store.shortageGoodsList = [] // 该门店已加购商品如果库存为0需单独分组
      }
      if (!Array.isArray(store.promotionGoodsList)) {
        store.promotionGoodsList = []
      }
      for (const activity of store.promotionGoodsList) {
        if (!Array.isArray(activity.goodsPromotionList)) {
          activity.goodsPromotionList = []
        }
        activity.goodsPromotionList = activity.goodsPromotionList.filter((goods: any) => {
          goods.originPrice = undefined

          // 统计是否有加购数大于库存数的商品
          if (goods.quantity > goods.stockQuantity) {
            store.storeStockShortage = true
          }
          // 统计是否全选
          if (!goods.isSelected) {
            store.isSelected = false
          }
          // 库存为0（无货）的商品单独分组
          if (goods.stockQuantity > 0) {
            return true
          }
          store.shortageGoodsList.push(goods)
          return false
        })
        if (activity.goodsPromotionList.length > 0) {
          isEmpty = false
        }
      }
      if (store.shortageGoodsList.length > 0) {
        isEmpty = false
      }
    }
    nextCartGroupData.storeGoods = storeGoods
    nextCartGroupData.invalidGoodItems = invalidGoodItems.map((goods: any) => {
      goods.originPrice = undefined
      return goods
    })
    nextCartGroupData.isNotEmpty = !isEmpty
    cartStoreGoods.value = storeGoods
    cartInvalidGoodItems.value = nextCartGroupData.invalidGoodItems
    cartIsNotEmpty.value = !!nextCartGroupData.isNotEmpty
    cartIsAllSelected.value = !!nextCartGroupData.isAllSelected
    cartSelectedGoodsCount.value = Number(nextCartGroupData.selectedGoodsCount || 0)
    cartTotalAmount.value = String(nextCartGroupData.totalAmount || '')
    cartTotalDiscountAmount.value = String(nextCartGroupData.totalDiscountAmount || '')
    Object.assign(cartGroupData, nextCartGroupData)
    hasLoadedCartData = true
  })
}

function ensureInitialDataLoaded() {
  if (hasRequestedInitialData) {
    return
  }
  hasRequestedInitialData = true
  refreshData()
}

function findGoods(spuId: string | number, skuId: string | number) {
  let currentStore: any
  let currentActivity: any
  let currentGoods: any
  const storeGoods = Array.isArray(cartGroupData.storeGoods) ? cartGroupData.storeGoods : []
  for (const store of storeGoods) {
    for (const activity of store.promotionGoodsList || []) {
      for (const goods of activity.goodsPromotionList || []) {
        if (goods.spuId === spuId && goods.skuId === skuId) {
          currentStore = store
          currentActivity = activity
          currentGoods = goods
          return {
            currentStore,
            currentActivity,
            currentGoods,
          }
        }
      }
    }
  }
  return {
    currentStore,
    currentActivity,
    currentGoods,
  }
}

// 注：实际场景时应该调用接口获取购物车数据
function getCartGroupData() {
  if (!hasLoadedCartData) {
    return fetchCartGroupData() as Promise<any>
  }
  return Promise.resolve({
    data: cartGroupData,
  })
}

// 选择单个商品
// 注：实际场景时应该调用接口更改选中状态
function selectGoodsService(payload: { spuId: string | number, skuId: string | number, isSelected: boolean }) {
  const { spuId, skuId, isSelected } = payload
  const target = findGoods(spuId, skuId).currentGoods
  if (target) {
    target.isSelected = isSelected
  }
  return Promise.resolve()
}

// 全选门店
// 注：实际场景时应该调用接口更改选中状态
function selectStoreService(payload: { storeId: string | number, isSelected: boolean }) {
  const { storeId, isSelected } = payload
  const target = cartGroupData.storeGoods?.find((store: any) => store.storeId === storeId)
  if (!target) {
    return Promise.resolve()
  }
  target.isSelected = isSelected
  target.promotionGoodsList?.forEach((activity: any) => {
    activity.goodsPromotionList?.forEach((goods: any) => {
      goods.isSelected = isSelected
    })
  })
  return Promise.resolve()
}

// 加购数量变更
// 注：实际场景时应该调用接口
function changeQuantityService(payload: { spuId: string | number, skuId: string | number, quantity: number }) {
  const { spuId, skuId, quantity } = payload
  const target = findGoods(spuId, skuId).currentGoods
  if (target) {
    target.quantity = quantity
  }
  return Promise.resolve()
}

// 删除加购商品
// 注：实际场景时应该调用接口
function deleteGoodsService(payload: { spuId: string | number, skuId: string | number }) {
  const { spuId, skuId } = payload
  function deleteGoods(group: any[]) {
    for (const index in group) {
      const goods = group[index]
      if (goods.spuId === spuId && goods.skuId === skuId) {
        group.splice(Number(index), 1)
        return index
      }
    }
    return -1
  }
  const storeGoods = cartGroupData.storeGoods || []
  const invalidGoodItems = cartGroupData.invalidGoodItems || []
  for (const store of storeGoods) {
    for (const activity of store.promotionGoodsList || []) {
      if (deleteGoods(activity.goodsPromotionList || []) !== -1) {
        return Promise.resolve()
      }
    }
    if (deleteGoods(store.shortageGoodsList || []) !== -1) {
      return Promise.resolve()
    }
  }
  if (deleteGoods(invalidGoodItems) !== -1) {
    return Promise.resolve()
  }
  return Promise.reject(new Error('goods not found'))
}

// 清空失效商品
// 注：实际场景时应该调用接口
function clearInvalidGoodsService() {
  cartGroupData.invalidGoodItems = []
  cartInvalidGoodItems.value = []
  return Promise.resolve()
}

function onGoodsSelect(e: any) {
  const spuId = e?.detail?.goods?.spuId
  const skuId = e?.detail?.goods?.skuId
  const isSelected = Boolean(e?.detail?.isSelected)
  const currentGoods = findGoods(spuId, skuId).currentGoods
  const title = currentGoods?.title || ''
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message: `${isSelected ? '选择' : '取消'}"${title.length > 5 ? `${title.slice(0, 5)}...` : title}"`,
    icon: '',
  })
  selectGoodsService({ spuId, skuId, isSelected }).then(() => refreshData())
}

function onStoreSelect(e: any) {
  const storeId = e?.detail?.store?.storeId
  const isSelected = Boolean(e?.detail?.isSelected)
  selectStoreService({ storeId, isSelected }).then(() => refreshData())
}

function onQuantityChange(e: any) {
  const spuId = e?.detail?.goods?.spuId
  const skuId = e?.detail?.goods?.skuId
  const quantity = Number(e?.detail?.quantity || 0)
  const currentGoods = findGoods(spuId, skuId).currentGoods
  const stockQuantity = currentGoods?.stockQuantity > 0 ? currentGoods.stockQuantity : 0 // 避免后端返回的是-1
  // 加购数量超过库存数量
  if (quantity > stockQuantity) {
    // 加购数量等于库存数量的情况下继续加购
    if (currentGoods?.quantity === stockQuantity && quantity - stockQuantity === 1) {
      Toast({
        context: nativeInstance,
        selector: '#t-toast',
        message: '当前商品库存不足',
      })
      return
    }
    Dialog.confirm({
      title: '商品库存不足',
      content: `当前商品库存不足，最大可购买数量为${stockQuantity}件`,
      confirmBtn: '修改为最大可购买数量',
      cancelBtn: '取消',
    }).then(() => {
      changeQuantityService({
        spuId,
        skuId,
        quantity: stockQuantity,
      }).then(() => refreshData())
    }).catch(() => {})
    return
  }
  changeQuantityService({
    spuId,
    skuId,
    quantity,
  }).then(() => refreshData())
}

function goCollect() {
  // 活动肯定有一个活动ID，用来获取活动banner，活动商品列表等
  const promotionID = '123'
  wx.navigateTo({
    url: `/pages/promotion/promotion-detail/index?promotion_id=${promotionID}`,
  })
}

function goGoodsDetail(e: any) {
  const spuId = e?.detail?.goods?.spuId
  const storeId = e?.detail?.goods?.storeId
  wx.navigateTo({
    url: `/pages/goods/details/index?spuId=${spuId}&storeId=${storeId}`,
  })
}

function clearInvalidGoods() {
  // 实际场景时应该调用接口清空失效商品
  clearInvalidGoodsService().then(() => refreshData())
}

function onGoodsDelete(e: any) {
  const spuId = e?.detail?.goods?.spuId
  const skuId = e?.detail?.goods?.skuId
  Dialog.confirm({
    content: '确认删除该商品吗?',
    confirmBtn: '确定',
    cancelBtn: '取消',
  }).then(() => {
    deleteGoodsService({ spuId, skuId }).then(() => {
      Toast({
        context: nativeInstance,
        selector: '#t-toast',
        message: '商品删除成功',
      })
      refreshData()
    })
  })
}

function onSelectAll(event: any) {
  const isAllSelected = Boolean(event?.detail?.isAllSelected)
  Toast({
    context: nativeInstance,
    selector: '#t-toast',
    message: `${isAllSelected ? '取消' : '点击'}了全选按钮`,
  })
  // 调用接口改变全选
}

function onToSettle() {
  const goodsRequestList: any[] = []
  const storeGoods = cartGroupData.storeGoods || []
  storeGoods.forEach((store: any) => {
    store.promotionGoodsList?.forEach((promotion: any) => {
      promotion.goodsPromotionList?.forEach((goods: any) => {
        if (goods.isSelected == 1) {
          goodsRequestList.push(goods)
        }
      })
    })
  })
  wx.setStorageSync('order.goodsRequestList', JSON.stringify(goodsRequestList))
  wx.navigateTo({
    url: '/pages/order/order-confirm/index?type=cart',
  })
}

function onGotoHome() {
  wx.switchTab({
    url: '/pages/home/home',
  })
}

onShow(() => {
  nativeInstance.getTabBar?.()?.init?.()
  ensureInitialDataLoaded()
})

onLoad(() => {
  ensureInitialDataLoaded()
})

defineExpose({
  cartGroupData,
  cartStoreGoods,
  cartInvalidGoodItems,
  cartIsNotEmpty,
  cartIsAllSelected,
  cartSelectedGoodsCount,
  cartTotalAmount,
  cartTotalDiscountAmount,
  refreshData,
  findGoods,
  getCartGroupData,
  selectGoodsService,
  selectStoreService,
  changeQuantityService,
  deleteGoodsService,
  clearInvalidGoodsService,
  onGoodsSelect,
  onStoreSelect,
  onQuantityChange,
  goCollect,
  goGoodsDetail,
  clearInvalidGoods,
  onGoodsDelete,
  onSelectAll,
  onToSettle,
  onGotoHome,
})
</script>

<template>
<!-- 分层购物车 -->
<block wx:if="{{cartIsNotEmpty}}">
  <cart-group
    store-goods="{{ cartStoreGoods }}"
    invalid-good-items="{{ cartInvalidGoodItems }}"
    bindselectgoods="onGoodsSelect"
    bindselectstore="onStoreSelect"
    bindchangequantity="onQuantityChange"
    bindgocollect="goCollect"
    bindgoodsclick="goGoodsDetail"
    bindclearinvalidgoods="clearInvalidGoods"
    binddelete="onGoodsDelete"
  />

  <view class="gap [height:100rpx] [width:100%]" />
  <!-- 商品小计以及结算按钮 -->
  <cart-bar
    is-all-selected="{{cartIsAllSelected}}"
    total-amount="{{cartTotalAmount}}"
    total-goods-num="{{cartSelectedGoodsCount}}"
    total-discount-amount="{{cartTotalDiscountAmount}}"
    fixed="{{true}}"
    bottomHeight="{{110}}"
    bindhandleSelectAll="onSelectAll"
    bindhandleToSettle="onToSettle"
  />
</block>
<!-- 购物车空态 -->
<cart-empty wx:else bind:handleClick="onGotoHome" />
<t-toast id="t-toast" />
<t-dialog id="t-dialog" />
</template>

<json>
{
  "navigationBarTitleText": "购物车",
  "usingComponents": {
    "cart-group": "./components/cart-group/index",
    "cart-empty": "./components/cart-empty/index",
    "cart-bar": "./components/cart-bar/index",
    "t-toast": "tdesign-miniprogram/toast/toast",
    "t-dialog": "tdesign-miniprogram/dialog/dialog"
  }
}</json>
