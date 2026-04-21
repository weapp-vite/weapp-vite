<script setup lang="ts">
import type { Address, DeliveryAddress } from '../../../../model/address'
import { onLoad, onUnload, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { getAddressPromise } from '../../../../services/address/edit'
import { fetchDeliveryAddressList } from '../../../../services/address/fetchAddress'
import { rejectAddress, resolveAddress } from '../../../../services/address/list'

type AddressItem = DeliveryAddress
type SavedAddress = Address

const nativeInstance = useNativeInstance()

const addressList = ref<AddressItem[]>([])
const deleteID = ref<string | number>('')
const showDeleteConfirm = ref(false)
const isOrderSure = ref(false)
const selectMode = ref(false)
const hasSelect = ref(false)
const currentId = ref('')
const extraSpace = ref(0)

function normalizeDeliveryAddress(address: SavedAddress): AddressItem {
  return {
    ...address,
    phoneNumber: address.phone,
    address: `${address.provinceName}${address.cityName}${address.districtName}${address.detailAddress}`,
    tag: address.addressTag,
  }
}

function init() {
  void getAddressList()
}

async function getAddressList() {
  const nextAddressList = await fetchDeliveryAddressList()
  addressList.value = nextAddressList.map((address) => {
    if (address.id === currentId.value) {
      return {
        ...address,
        checked: true,
      }
    }
    return address
  })
}

function confirmDeleteHandle({ detail }: { detail?: { id?: string | number } }) {
  const id = detail?.id
  if (id !== undefined) {
    deleteID.value = id
    showDeleteConfirm.value = true
    showToast({
      context: nativeInstance as any,
      message: '地址删除成功',
      theme: 'success',
      duration: 1000,
    })
    return
  }
  showToast({
    context: nativeInstance as any,
    message: '需要组件库发新版才能拿到地址ID',
    icon: '',
    duration: 1000,
  })
}

async function editAddressHandle({ detail }: { detail?: { id?: string | number } }) {
  waitForNewAddress()
  const id = detail?.id ?? ''
  await wpi.navigateTo({
    url: `/pages/user/address/edit/index?id=${id}`,
  })
}

async function selectHandle({ detail }: { detail?: AddressItem }) {
  if (selectMode.value) {
    hasSelect.value = true
    resolveAddress(detail)
    await wpi.navigateBack({
      delta: 1,
    })
    return
  }
  await editAddressHandle({
    detail,
  })
}

async function createHandle() {
  waitForNewAddress()
  await wpi.navigateTo({
    url: '/pages/user/address/edit/index',
  })
}

function waitForNewAddress() {
  getAddressPromise().then((nextAddress) => {
    if (!nextAddress) {
      return
    }
    const newAddress = normalizeDeliveryAddress({ ...nextAddress })
    let nextAddressList = [...addressList.value]
    if (!newAddress.addressId) {
      newAddress.id = `${nextAddressList.length}`
      newAddress.addressId = `${nextAddressList.length}`
      if (newAddress.isDefault === 1) {
        nextAddressList = nextAddressList.map(address => ({
          ...address,
          isDefault: 0,
        }))
      }
      else {
        newAddress.isDefault = 0
      }
      nextAddressList.push(newAddress)
    }
    else {
      nextAddressList = nextAddressList.map((address) => {
        if (address.addressId === newAddress.addressId) {
          return newAddress
        }
        return address
      })
    }
    nextAddressList.sort((prevAddress, nextAddressItem) => {
      if (prevAddress.isDefault && !nextAddressItem.isDefault) {
        return -1
      }
      if (!prevAddress.isDefault && nextAddressItem.isDefault) {
        return 1
      }
      return 0
    })
    addressList.value = nextAddressList
  }).catch((error) => {
    if (error.message !== 'cancel') {
      showToast({
        context: nativeInstance as any,
        message: '地址编辑发生错误',
        icon: '',
        duration: 1000,
      })
    }
  })
}

onLoad((query: Record<string, string | undefined>) => {
  const {
    selectMode: nextSelectMode = '',
    isOrderSure: nextIsOrderSure = '',
    id = '',
  } = query
  isOrderSure.value = !!nextIsOrderSure
  currentId.value = id
  selectMode.value = !!nextSelectMode
  init()
})

onUnload(() => {
  if (selectMode.value && !hasSelect.value) {
    rejectAddress()
  }
})

definePageJson({
  navigationBarTitleText: '收货地址',
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-image': '/components/webp-image/index',
    't-address-item': '/pages/user/components/ui-address-item/index',
    't-location': '/pages/user/components/t-location/index',
    't-empty': 'tdesign-miniprogram/empty/empty',
  },
})
</script>

<template>
  <view class="address-container flex flex-col items-stretch pb-[calc(env(safe-area-inset-bottom)+172rpx)] [&_.address-list]:text-[24rpx] [&_.address-list]:bg-[#ffffff] [&_.address-list]:[-webkit-overflow-scrolling:touch] [&_.bottom-fixed]:[border-top:1rpx_solid_#e5e5e5] [&_.bottom-fixed]:fixed [&_.bottom-fixed]:bottom-0 [&_.bottom-fixed]:inset-x-0 [&_.bottom-fixed]:z-1000 [&_.bottom-fixed]:[background:#fff] [&_.bottom-fixed]:flex [&_.bottom-fixed]:justify-center [&_.bottom-fixed]:flex-col [&_.bottom-fixed]:items-center [&_.bottom-fixed]:p-[12rpx_32rpx_calc(env(safe-area-inset-bottom)+12rpx)_32rpx] [&_.btn-wrap]:w-full [&_.btn-wrap]:flex [&_.btn-wrap]:justify-between [&_.btn-wrap]:items-center [&_.btn-wrap]:text-[32rpx] [&_.btn-wrap]:[font-weight:bold] [&_.btn-wrap_.location-btn]:w-[332rpx] [&_.btn-wrap_.location-btn]:h-[88rpx] [&_.btn-wrap_.location-btn]:flex [&_.btn-wrap_.location-btn]:justify-center [&_.btn-wrap_.location-btn]:items-center [&_.btn-wrap_.location-btn]:bg-[#ffffff] [&_.btn-wrap_.location-btn]:text-[#333] [&_.btn-wrap_.location-btn]:relative [&_.btn-wrap_.address-btn]:w-[332rpx] [&_.btn-wrap_.address-btn]:h-[88rpx] [&_.btn-wrap_.address-btn]:flex [&_.btn-wrap_.address-btn]:justify-center [&_.btn-wrap_.address-btn]:items-center [&_.btn-wrap_.address-btn]:bg-[#fa4126] [&_.btn-wrap_.address-btn]:rounded-[44rpx] [&_.btn-wrap_.address-btn]:text-white [&_.btn-wrap_.btn-default]:[background:#c6c6c6] [&_.bottom-fixed_.footer]:mt-[10rpx] [&_.bottom-fixed_.footer]:inline-block [&_.bottom-fixed_.footer]:w-full [&_.bottom-fixed_.footer]:text-center [&_.bottom-fixed_.footer]:text-[24rpx] [&_.bottom-fixed_.footer]:font-normal [&_.bottom-fixed_.footer]:text-[#ff2525] [&_.bottom-fixed_.footer]:leading-[60rpx] [&_.bottom-fixed_.footer]:h-[60rpx] [&_.message]:mt-[48rpx] [&_.custom-class]:mr-[12rpx] [&_.custom-class]:[font-weight:normal]">
    <view v-if="addressList.length > 0" class="address-list [&_.no-address]:w-[750rpx] [&_.no-address]:pt-[30vh] [&_.no-address]:flex [&_.no-address]:flex-col [&_.no-address]:justify-start [&_.no-address]:items-center [&_.no-address__icon]:size-[224rpx] [&_.no-address__text]:text-[28rpx] [&_.no-address__text]:leading-[40rpx] [&_.no-address__text]:text-[#999999] [&_.no-address__text]:mt-[24rpx]">
      <block v-for="(address, index) in addressList" :key="address.id">
        <t-address-item
          :isDrawLine="index + 1 !== addressList.length"
          :extra-space="extraSpace"
          class-prefix="ym"
          :address="address"
          :data-id="address.id"
          @onSelect="selectHandle"
          @onDelete="confirmDeleteHandle"
          @onEdit="editAddressHandle"
        />
      </block>
    </view>
    <view v-else class="no-address">
      <t-empty icon="" description="暂无收货地址，赶快添加吧" />
    </view>
    <view class="bottom-fixed">
      <view class="btn-wrap">
        <t-location
          title="微信地址导入"
          :isOrderSure="isOrderSure"
          :isDisabledBtn="addressList.length >= 20"
          navigateUrl="/pages/user/address/edit/index"
          navigateEvent="onWeixinAddressPassed"
          t-class="location-btn"
          :isCustomStyle="true"
          @navigate="waitForNewAddress"
        />
        <view :class="`address-btn ${addressList.length >= 20 ? 'btn-default' : ''}`" @tap="createHandle">
          <t-icon name="add" size="48rpx" color="#fff" t-class="custom-class" />
          <text>新建收货地址</text>
        </view>
      </view>
      <view v-if="addressList.length >= 20" class="footer">
        最多支持添加20个收货地址
      </view>
    </view>
  </view>
</template>
