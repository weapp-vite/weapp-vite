<script setup lang="ts">
import { onLoad, onShow, ref, useAsyncPullDownRefresh, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { fetchUserCenter } from '../../services/usercenter/fetchUsercenter'

interface MenuItem {
  title: string
  tit: string | number
  url: string
  type: string
  icon?: string
}

const nativeInstance = useNativeInstance()

const showMakePhone = ref(false)
const userInfo = ref({
  avatarUrl: '',
  nickName: '正在登录...',
  phoneNumber: '',
})
const menuData = ref<MenuItem[][]>([
  [
    {
      title: '收货地址',
      tit: '',
      url: '',
      type: 'address',
    },
    {
      title: '优惠券',
      tit: '',
      url: '',
      type: 'coupon',
    },
    {
      title: '积分',
      tit: '',
      url: '',
      type: 'point',
    },
  ],
  [
    {
      title: '帮助中心',
      tit: '',
      url: '',
      type: 'help-center',
    },
    {
      title: '客服热线',
      tit: '',
      url: '',
      type: 'service',
      icon: 'service',
    },
  ],
])
const orderTagInfos = ref<Array<Record<string, any>>>([
  {
    title: '待付款',
    iconName: 'wallet',
    orderNum: 0,
    tabType: 5,
    status: 1,
  },
  {
    title: '待发货',
    iconName: 'deliver',
    orderNum: 0,
    tabType: 10,
    status: 1,
  },
  {
    title: '待收货',
    iconName: 'package',
    orderNum: 0,
    tabType: 40,
    status: 1,
  },
  {
    title: '待评价',
    iconName: 'comment',
    orderNum: 0,
    tabType: 60,
    status: 1,
  },
  {
    title: '退款/售后',
    iconName: 'exchang',
    orderNum: 0,
    tabType: 0,
    status: 1,
  },
])
const customerServiceInfo = ref<Record<string, any>>({})
const currAuthStep = ref(1)
const showKefu = ref(true)
const versionNo = ref('')

function init() {
  void fetUseriInfoHandle()
}

function fetUseriInfoHandle() {
  return fetchUserCenter().then(({
    userInfo: nextUserInfo,
    countsData,
    orderTagInfos: orderInfo,
    customerServiceInfo: nextCustomerServiceInfo,
  }: {
    userInfo: Partial<{ avatarUrl: string, nickName: string, phoneNumber: string }>
    countsData: Array<{ type: string, num: string | number }>
    orderTagInfos: Array<Record<string, any>>
    customerServiceInfo: Record<string, any>
  }) => {
    const nextMenuData = menuData.value.map(group => group.map(item => ({ ...item })))
    nextMenuData?.[0]?.forEach((item) => {
      countsData.forEach((counts) => {
        if (counts.type === item.type) {
          item.tit = counts.num
        }
      })
    })
    const info = orderTagInfos.value.map((item, index) => ({
      ...item,
      ...(orderInfo[index] || {}),
    }))
    userInfo.value = {
      ...userInfo.value,
      ...nextUserInfo,
    }
    menuData.value = nextMenuData
    orderTagInfos.value = info
    customerServiceInfo.value = nextCustomerServiceInfo
    currAuthStep.value = 2
  })
}

async function onClickCell({ currentTarget }: any) {
  const type = currentTarget?.dataset?.type
  switch (type) {
    case 'address':
      await wpi.navigateTo({
        url: '/pages/user/address/list/index',
      })
      break
    case 'service':
      openMakePhone()
      break
    case 'help-center':
      showToast({
        context: nativeInstance,
        message: '你点击了帮助中心',
        icon: '',
        duration: 1000,
      })
      break
    case 'point':
      showToast({
        context: nativeInstance,
        message: '你点击了积分菜单',
        icon: '',
        duration: 1000,
      })
      break
    case 'coupon':
      await wpi.navigateTo({
        url: '/pages/coupon/coupon-list/index',
      })
      break
    default:
      showToast({
        context: nativeInstance,
        message: '未知跳转',
        icon: '',
        duration: 1000,
      })
      break
  }
}

async function jumpNav(e: any) {
  const status = e?.detail?.tabType
  if (status === 0) {
    await wpi.navigateTo({
      url: '/pages/order/after-service-list/index',
    })
  }
  else {
    await wpi.navigateTo({
      url: `/pages/order/order-list/index?status=${status}`,
    })
  }
}

async function jumpAllOrder() {
  await wpi.navigateTo({
    url: '/pages/order/order-list/index',
  })
}

function openMakePhone() {
  showMakePhone.value = true
}

function closeMakePhone() {
  showMakePhone.value = false
}

async function call() {
  await wpi.makePhoneCall({
    phoneNumber: customerServiceInfo.value.servicePhone,
  })
}

async function gotoUserEditPage() {
  if (currAuthStep.value === 2) {
    await wpi.navigateTo({
      url: '/pages/user/person-info/index',
    })
  }
  else {
    await fetUseriInfoHandle()
  }
}

function getVersionInfo() {
  const versionInfo = wpi.getAccountInfoSync() as any
  const miniProgramInfo = versionInfo?.miniProgram || {}
  const version = miniProgramInfo.version || ''
  const envVersion = miniProgramInfo.envVersion ?? (globalThis as any).__wxConfig
  versionNo.value = envVersion === 'release' ? version : (envVersion || '')
}

onLoad(() => {
  getVersionInfo()
})

onShow(() => {
  nativeInstance.getTabBar?.()?.init?.()
  init()
})

useAsyncPullDownRefresh(fetUseriInfoHandle)

defineExpose({
  showMakePhone,
  userInfo,
  menuData,
  orderTagInfos,
  customerServiceInfo,
  currAuthStep,
  showKefu,
  versionNo,
  onClickCell,
  jumpNav,
  jumpAllOrder,
  openMakePhone,
  closeMakePhone,
  call,
  gotoUserEditPage,
})

definePageJson({
  navigationBarTitleText: '个人中心',
  navigationStyle: 'custom',
  usingComponents: {
    't-popup': 'tdesign-miniprogram/popup/popup',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-user-center-card': './components/user-center-card/index',
    't-order-group': './components/order-group/index',
  },
  enablePullDownRefresh: true,
})
</script>

<template>
  <t-user-center-card
    :userInfo="userInfo"
    :isPhoneHide="true"
    name-class="custom-name-class"
    phone-class="custom-phone-class"
    avatar-class="customer-avatar-class"
    :currAuthStep="currAuthStep"
    @gotoUserEditPage="gotoUserEditPage"
  />
  <view class="content-wrapper mt-[340rpx] relative p-[0_30rpx]">
    <view class="order-group-wrapper mb-[16rpx]">
      <t-order-group :orderTagInfos="orderTagInfos" @onClickTop="jumpAllOrder" @onClickItem="jumpNav" />
    </view>
    <view v-for="item in menuData" :key="item[0]?.type || 'menu-group'" class="cell-box rounded-[10rpx] overflow-hidden mb-[20rpx] [&_.order-group__left]:mr-0 [&_.t-cell-padding]:p-[24rpx_18rpx_24rpx_32rpx]">
      <t-cell-group>
        <t-cell
          v-for="(xitem, xindex) in item"
          :key="xindex"
          :title="xitem.title"
          :arrow="!xitem.icon"
          :note="xitem.tit"
          :data-type="xitem.type"
          :bordered="false"
          t-class="t-cell-padding"
          t-class-note="order-group-note"
          t-class-left="order-group__left"
          @click="onClickCell"
        >
          <template #note>
            <t-icon :name="xitem.icon" size="48rpx" />
          </template>
        </t-cell>
      </t-cell-group>
    </view>
  </view>
  <view v-if="versionNo !== ''" class="footer__version text-center mt-[50rpx] text-[#999] mb-[4rpx] text-[24rpx] leading-[32rpx]">
    当前版本 {{ versionNo }}
  </view>
  <t-popup :visible="showMakePhone" placement="bottom" data-index="2" @visible-change="closeMakePhone">
    <view class="popup-content [background:#f5f5f5] mb-[env(safe-area-inset-bottom)] rounded-[16rpx_16rpx_0_0] [&_.popup-title]:[background:#fff] [&_.popup-title]:text-center [&_.popup-title]:text-[24rpx] [&_.popup-title]:text-[#999] [&_.popup-title]:h-[112rpx] [&_.popup-title]:leading-[112rpx] [&_.popup-title]:rounded-[16rpx_16rpx_0_0] [&_.popup-phone]:[background:#fff] [&_.popup-phone]:h-[100rpx] [&_.popup-phone]:flex [&_.popup-phone]:justify-center [&_.popup-phone]:items-center [&_.popup-phone]:text-center [&_.popup-phone]:text-[30rpx] [&_.popup-phone]:font-[PingFangSC-Regular,PingFang_SC] [&_.popup-phone]:font-normal [&_.popup-phone]:text-[#333] [&_.popup-close]:[background:#fff] [&_.popup-close]:h-[100rpx] [&_.popup-close]:flex [&_.popup-close]:justify-center [&_.popup-close]:items-center [&_.popup-close]:text-center [&_.popup-close]:text-[30rpx] [&_.popup-close]:font-[PingFangSC-Regular,PingFang_SC] [&_.popup-close]:font-normal [&_.popup-close]:text-[#333] [&_.popup-phone_.online]:mb-[20rpx] [&_.popup-close]:[border:0] [&_.popup-close]:mt-[16rpx]">
      <view v-if="customerServiceInfo.serviceTimeDuration" class="popup-title border-bottom-1px relative">
        服务时间: {{ customerServiceInfo.serviceTimeDuration }}
      </view>
      <view :class="`popup-phone ${showKefu ? 'border-bottom-1px' : ''} relative`" @tap="call">
        电话客服
      </view>
      <button v-if="showKefu" class="popup-phone border-bottom-1px online relative" open-type="contact">
        在线客服
      </button>
      <view class="popup-close" @tap="closeMakePhone">
        取消
      </view>
    </view>
  </t-popup>
</template>
