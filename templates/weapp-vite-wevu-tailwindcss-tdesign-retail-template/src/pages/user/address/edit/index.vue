<script setup lang="ts">
import type { Address } from '../../../../model/address'
import { onLoad, onUnload, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'
import { areaData } from '../../../../config/index'
import { fetchDeliveryAddress } from '../../../../services/address/fetchAddress'
import { rejectAddress, resolveAddress } from '../../../../services/address/list'

interface LabelItem {
  id: number
  name: string
}

interface AddressFormState {
  labelIndex: number | null
  addressId: string
  addressTag: string
  cityCode: string
  cityName: string
  countryCode: string
  countryName: string
  detailAddress: string
  districtCode: string
  districtName: string
  isDefault: 0 | 1
  name: string
  phone: string
  provinceCode: string
  provinceName: string
  isEdit: boolean
  isOrderDetail: boolean
  isOrderSure: boolean
  latitude: string
  longitude: string
}

interface InputChangeEvent {
  currentTarget?: { dataset?: { item?: string } }
  detail?: {
    value?: string
    selectedOptions?: Array<{ value: string, label: string }>
  }
}

const nativeInstance = useNativeInstance()
const RECEIVER_NAME_RE = /^[a-z\d\u4E00-\u9FA5]+$/i
const RECEIVER_PHONE_RE = /^1(?:3\d|4[4-9]|5[0-35-9]|6[67]|7[0-8]|8\d|9\d)\d{8}$/

const defaultLabels: LabelItem[] = [
  {
    id: 0,
    name: '家',
  },
  {
    id: 1,
    name: '公司',
  },
]

function createInitialLocationState(): AddressFormState {
  return {
    labelIndex: null,
    addressId: '',
    addressTag: '',
    cityCode: '',
    cityName: '',
    countryCode: '',
    countryName: '',
    detailAddress: '',
    districtCode: '',
    districtName: '',
    isDefault: 0,
    name: '',
    phone: '',
    provinceCode: '',
    provinceName: '',
    isEdit: false,
    isOrderDetail: false,
    isOrderSure: false,
    latitude: '',
    longitude: '',
  }
}

const locationState = ref<AddressFormState>(createInitialLocationState())
const labels = ref<LabelItem[]>([...defaultLabels])
const areaPickerVisible = ref(false)
const submitActive = ref(false)
const visible = ref(false)
const labelValue = ref('')
const hasSaved = ref(false)
const verifyTips = ref('')

function updateSubmitState() {
  const validationResult = onVerifyInputLegal()
  submitActive.value = validationResult.isLegal
  verifyTips.value = validationResult.tips
}

function syncLocationState(nextState: Partial<AddressFormState>) {
  locationState.value = {
    ...locationState.value,
    ...nextState,
  }
  updateSubmitState()
}

function getLabelIndexByTag(addressTag: string) {
  const index = labels.value.findIndex(label => label.name === addressTag)
  return index >= 0 ? index : null
}

async function getAddressDetail(id: number) {
  const detail = await fetchDeliveryAddress(id)
  locationState.value = {
    ...locationState.value,
    ...detail,
    labelIndex: getLabelIndexByTag(detail.addressTag),
    isDefault: detail.isDefault,
    latitude: detail.latitude,
    longitude: detail.longitude,
  }
  updateSubmitState()
}

function init(id?: string) {
  if (id) {
    void getAddressDetail(Number(id))
  }
}

function onInputValue(e: InputChangeEvent) {
  const item = e.currentTarget?.dataset?.item
  if (!item) {
    return
  }
  if (item === 'address') {
    const selectedOptions = e.detail?.selectedOptions ?? []
    if (selectedOptions.length < 3) {
      return
    }
    syncLocationState({
      provinceCode: selectedOptions[0]?.value ?? '',
      provinceName: selectedOptions[0]?.label ?? '',
      cityName: selectedOptions[1]?.label ?? '',
      cityCode: selectedOptions[1]?.value ?? '',
      districtCode: selectedOptions[2]?.value ?? '',
      districtName: selectedOptions[2]?.label ?? '',
    })
    areaPickerVisible.value = false
    return
  }

  const value = e.detail?.value ?? ''
  syncLocationState({
    [item]: value,
  } as Partial<AddressFormState>)
}

function onPickArea() {
  areaPickerVisible.value = true
}

function onPickLabels(e: { currentTarget?: { dataset?: { item?: number } } }) {
  const item = e.currentTarget?.dataset?.item
  if (item === undefined) {
    return
  }
  if (item === locationState.value.labelIndex) {
    syncLocationState({
      labelIndex: null,
      addressTag: '',
    })
    return
  }
  syncLocationState({
    labelIndex: item,
    addressTag: labels.value[item]?.name ?? '',
  })
}

function addLabels() {
  visible.value = true
}

function confirmHandle() {
  const nextLabel = labelValue.value.trim()
  if (!nextLabel) {
    visible.value = false
    labelValue.value = ''
    return
  }
  labels.value = [
    ...labels.value,
    {
      id: (labels.value.at(-1)?.id ?? 0) + 1,
      name: nextLabel,
    },
  ]
  visible.value = false
  labelValue.value = ''
}

function cancelHandle() {
  visible.value = false
  labelValue.value = ''
}

function onCheckDefaultAddress({ detail }: { detail?: { value?: boolean | 0 | 1 } }) {
  syncLocationState({
    isDefault: detail?.value ? 1 : 0,
  })
}

function onVerifyInputLegal() {
  const {
    name,
    phone,
    detailAddress,
    districtName,
  } = locationState.value
  if (!name || !name.trim()) {
    return {
      isLegal: false,
      tips: '请填写收货人',
    }
  }
  if (!RECEIVER_NAME_RE.test(name)) {
    return {
      isLegal: false,
      tips: '收货人仅支持输入中文、英文（区分大小写）、数字',
    }
  }
  if (!phone || !phone.trim()) {
    return {
      isLegal: false,
      tips: '请填写手机号',
    }
  }
  if (!RECEIVER_PHONE_RE.test(phone)) {
    return {
      isLegal: false,
      tips: '请填写正确的手机号',
    }
  }
  if (!districtName || !districtName.trim()) {
    return {
      isLegal: false,
      tips: '请选择省市区信息',
    }
  }
  if (!detailAddress || !detailAddress.trim()) {
    return {
      isLegal: false,
      tips: '请完善详细地址',
    }
  }
  if (detailAddress.trim().length > 50) {
    return {
      isLegal: false,
      tips: '详细地址不能超过50个字符',
    }
  }
  return {
    isLegal: true,
    tips: '添加成功',
  }
}

async function builtInSearch({ code, name }: { code: string, name: string }) {
  const settingRes = await wpi.getSetting()
  const authSetting = settingRes.authSetting as Record<string, boolean | undefined>
  if (authSetting[code] !== false) {
    return
  }
  const modalRes = await wpi.showModal({
    title: `获取${name}失败`,
    content: `获取${name}失败，请在【右上角】-小程序【设置】项中，将【${name}】开启。`,
    confirmText: '去设置',
    confirmColor: '#FA550F',
    cancelColor: '取消',
  })
  if (!modalRes.confirm) {
    throw new Error(`用户取消开启${name}权限`)
  }
  const openSettingRes = await wpi.openSetting()
  const nextAuthSetting = openSettingRes.authSetting as Record<string, boolean | undefined>
  if (nextAuthSetting[code] !== true) {
    throw new Error(`用户未开启${name}权限`)
  }
}

async function onSearchAddress() {
  await builtInSearch({
    code: 'scope.userLocation',
    name: '地址位置',
  })
  try {
    const res = await wpi.chooseLocation({} as any)
    if (!res.name) {
      showToast({
        context: nativeInstance as any,
        message: '地点为空，请重新选择',
        icon: '',
        duration: 1000,
      })
      return
    }
    syncLocationState({
      detailAddress: res.address || res.name,
      latitude: String(res.latitude ?? ''),
      longitude: String(res.longitude ?? ''),
    })
  }
  catch (error: any) {
    if (error?.errMsg !== 'chooseLocation:fail cancel') {
      showToast({
        context: nativeInstance as any,
        message: '地点错误，请重新选择',
        icon: '',
        duration: 1000,
      })
    }
  }
}

async function formSubmit() {
  if (!submitActive.value) {
    showToast({
      context: nativeInstance as any,
      message: verifyTips.value,
      icon: '',
      duration: 1000,
    })
    return
  }

  hasSaved.value = true
  const currentState = locationState.value
  resolveAddress({
    saasId: '88888888',
    uid: '88888888205500',
    authToken: null,
    id: currentState.addressId,
    addressId: currentState.addressId,
    phone: currentState.phone,
    phoneNumber: currentState.phone,
    name: currentState.name,
    countryName: currentState.countryName,
    countryCode: currentState.countryCode,
    provinceName: currentState.provinceName,
    provinceCode: currentState.provinceCode,
    cityName: currentState.cityName,
    cityCode: currentState.cityCode,
    districtName: currentState.districtName,
    districtCode: currentState.districtCode,
    detailAddress: currentState.detailAddress,
    address: `${currentState.provinceName}${currentState.cityName}${currentState.districtName}${currentState.detailAddress}`,
    isDefault: currentState.isDefault,
    addressTag: currentState.addressTag,
    tag: currentState.addressTag,
    latitude: currentState.latitude,
    longitude: currentState.longitude,
    storeId: null,
  })
  await wpi.navigateBack({
    delta: 1,
  })
}

function getWeixinAddress(e: { detail?: Partial<Address> }) {
  syncLocationState({
    ...e.detail,
    labelIndex: getLabelIndexByTag(e.detail?.addressTag ?? ''),
    isDefault: e.detail?.isDefault ?? locationState.value.isDefault,
    latitude: e.detail?.latitude ?? locationState.value.latitude,
    longitude: e.detail?.longitude ?? locationState.value.longitude,
  })
}

onLoad((options: { id?: string } = {}) => {
  init(options.id)
})

onUnload(() => {
  if (!hasSaved.value) {
    rejectAddress()
  }
})

definePageJson({
  navigationBarTitleText: '添加新地址',
  usingComponents: {
    't-textarea': 'tdesign-miniprogram/textarea/textarea',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-input': 'tdesign-miniprogram/input/input',
    't-button': 'tdesign-miniprogram/button/button',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
    't-switch': 'tdesign-miniprogram/switch/switch',
    't-location': '/pages/user/components/t-location/index',
    't-cascader': 'tdesign-miniprogram/cascader/cascader',
  },
})
</script>

<template>
  <view class="address-detail text-[30rpx]">
    <view class="divider-line w-full h-[20rpx] bg-[#f5f5f5]" />
    <t-location
      title="获取微信收获地址"
      isCustomStyle
      t-class="address-detail-wx-location [background:#fff] [padding:24rpx_32rpx] [display:flex] [align-items:center] [justify-content:space-between]"
      @change="getWeixinAddress"
    >
      <t-icon class="address-detail-wx-arrow items-end" name="arrow_forward" prefix="wr" color="#bbb" size="32rpx" />
    </t-location>
    <view class="divider-line w-full h-[20rpx] bg-[#f5f5f5]" />
    <view class="form-address [&_.map]:text-[48rpx] [&_.map]:ml-[20rpx] [&_.map]:text-[#9d9d9f] [&_.label-list]:[background:#f5f5f5] [&_.label-list]:text-[#333] [&_.label-list]:min-w-[100rpx] [&_.label-list]:mr-[32rpx] [&_.label-list]:text-[26rpx] [&_.label-list]:[border:2rpx_solid_transparent] [&_.label-list]:w-auto [&_.active-btn]:text-[#fa4126] [&_.active-btn]:[border:2rpx_solid_#fa4126] [&_.active-btn]:[background:rgba(255,95,21,0.04)]">
      <form class="form-content">
        <t-cell-group>
          <t-cell class="form-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none" t-class-title="t-cell-title" title="收货人" t-class-note="t-cell-note">
            <template #note>
              <t-input
                class="t-input"
                t-class="field-text"
                borderless
                data-item="name"
                maxlength="20"
                type="text"
                :value="locationState.name"
                placeholder="您的姓名"
                @change="onInputValue"
              />
            </template>
          </t-cell>
          <t-cell class="form-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none" t-class-title="t-cell-title" title="手机号">
            <template #note>
              <t-input
                class="t-input"
                t-class="field-text"
                borderless
                type="number"
                :value="locationState.phone"
                maxlength="11"
                placeholder="联系您的手机号"
                data-item="phone"
                @change="onInputValue"
              />
            </template>
          </t-cell>
          <t-cell class="form-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none" t-class-title="t-cell-title" title="地区">
            <template #note>
              <t-input
                class="t-input"
                t-class="field-text"
                borderless
                placeholder="省/市/区"
                data-item="address"
                :value="`${locationState.provinceName ? `${locationState.provinceName}/` : ''}${locationState.cityName ? `${locationState.cityName}/` : ''}${locationState.districtName}`"
                disabled
                @tap.stop="onPickArea"
              />
            </template>
            <template #right-icon>
              <t-icon t-class="map" prefix="wr" name="location" @tap.stop="onSearchAddress" />
            </template>
          </t-cell>
          <t-cell class="form-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none" t-class-title="t-cell-title" title="详细地址" :bordered="false">
            <template #note>
              <view class="textarea__wrapper w-full [&_.t-textarea]:p-0">
                <t-textarea
                  type="text"
                  :value="locationState.detailAddress"
                  placeholder="门牌号等(例如:10栋1001号)"
                  autosize
                  data-item="detailAddress"
                  @change="onInputValue"
                />
              </view>
            </template>
          </t-cell>

          <view class="divider-line w-full h-[20rpx] bg-[#f5f5f5]" />
          <t-cell
            class="form-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none"
            t-class-note="t-cell-note address__tag"
            t-class-title="t-cell-title"
            title="标签"
            :bordered="false"
          >
            <template #note>
              <view class="t-input address-flex-box flex flex-wrap">
                <t-button
                  v-for="(label, index) in labels"
                  :key="index"
                  size="extra-small"
                  :t-class="`label-list ${locationState.labelIndex === index ? 'active-btn' : ''}`"
                  :data-item="index"
                  @tap="onPickLabels"
                >
                  {{ label.name }}
                </t-button>
                <t-button size="extra-small" t-class="label-list" @tap="addLabels">
                  <t-icon name="add" size="40rpx" color="#bbb" />
                </t-button>
              </view>
            </template>
          </t-cell>
          <view class="divider-line w-full h-[20rpx] bg-[#f5f5f5]" />
          <t-cell title="设置为默认收货地址" :bordered="false">
            <template #note>
              <t-switch
                :value="locationState.isDefault"
                :colors="['#0ABF5B', '#c6c6c6']"
                @change="onCheckDefaultAddress"
              />
            </template>
          </t-cell>
        </t-cell-group>
        <view class="submit box-border p-[64rpx_30rpx_88rpx_30rpx] [&_.btn-submit-address]:[background:#fa4126] [&_.btn-submit-address]:text-white">
          <t-button shape="round" block :disabled="!submitActive" @tap="formSubmit">
            保存
          </t-button>
        </view>
      </form>
    </view>
    <t-cascader
      data-item="address"
      data-type="1"
      :visible="areaPickerVisible"
      theme="tab"
      :options="areaData"
      :value="locationState.districtCode"
      title="选择地区"
      @change="onInputValue"
    />
  </view>
  <t-dialog
    :visible="visible"
    t-class-confirm="dialog__button-confirm"
    t-class-cancel="dialog__button-cancel"
    title="填写标签名称"
    confirm-btn="确定"
    cancel-btn="取消"
    @confirm="confirmHandle"
    @cancel="cancelHandle"
  >
    <template #content>
      <t-input v-model:value="labelValue" class="dialog__input mt-[32rpx] rounded-[8rpx] box-border [--td-input-vertical-padding:12px] [--td-input-bg-color:#f3f3f3]" placeholder="请输入标签名称" borderless />
    </template>
  </t-dialog>
</template>
