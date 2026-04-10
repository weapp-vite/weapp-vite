<script setup lang="ts">
import type { TrackingCompany, TrackingSubmitParams } from './api'
import { computed, onLoad, ref } from 'wevu'
import { wpi } from 'wevu/api'
import { confirmDialog } from '@/hooks/useDialog'
import { showToast } from '@/hooks/useToast'
import reasonSheet from '../components/reason-sheet/reasonSheet'
import { create, getDeliverCompanyList, update } from './api'

interface QueryOptions {
  rightsNo?: string
  logisticsNo?: string
  logisticsCompanyName?: string
  logisticsCompanyCode?: string
  remark?: string
}

interface InputEvent {
  currentTarget?: {
    dataset?: {
      key?: 'trackingNo' | 'remark'
    }
  }
  detail?: {
    value?: string
  }
}

const rightsNo = ref('')
const isChange = ref(false)
const trackingNo = ref('')
const remark = ref('')
const deliveryCompany = ref<TrackingCompany | null>(null)
const submitting = ref(false)
const deliveryCompanyList = ref<TrackingCompany[]>([])

const submitActived = computed(() => !!trackingNo.value && !!deliveryCompany.value)
const deliveryCompanyLabel = computed(() => deliveryCompany.value?.name || '请选择物流公司')

async function ensureRightsNo(query: QueryOptions) {
  if (query.rightsNo) {
    return true
  }
  await confirmDialog({
    title: '请选择售后单？',
    content: '',
    confirmBtn: '确认',
  })
  await wpi.navigateBack({
    delta: 1,
  })
  return false
}

async function getDeliveryCompanyOptions() {
  if (deliveryCompanyList.value.length) {
    return deliveryCompanyList.value
  }
  const response = await getDeliverCompanyList()
  deliveryCompanyList.value = response.data ?? []
  return deliveryCompanyList.value
}

function onInput(event: InputEvent) {
  const key = event.currentTarget?.dataset?.key
  const value = event.detail?.value ?? ''
  if (key === 'trackingNo') {
    trackingNo.value = value
    return
  }
  if (key === 'remark') {
    remark.value = value
  }
}

async function onCompanyTap() {
  const companies = await getDeliveryCompanyOptions()
  try {
    const indexes = await reasonSheet({
      show: true,
      title: '选择物流公司',
      options: companies.map(company => ({
        title: company.name,
        checked: company.code === deliveryCompany.value?.code,
      })),
      showConfirmButton: true,
      showCancelButton: true,
      emptyTip: '请选择物流公司',
    })
    deliveryCompany.value = companies[indexes[0]] ?? null
  }
  catch {}
}

function validateForm() {
  if (!trackingNo.value) {
    return '请填写运单号'
  }
  if (!deliveryCompany.value) {
    return '请选择物流公司'
  }
  return ''
}

async function onSubmit() {
  const errorMessage = validateForm()
  if (errorMessage) {
    showToast({
      message: errorMessage,
      icon: '',
    })
    return
  }
  if (!deliveryCompany.value) {
    return
  }

  const params: TrackingSubmitParams = {
    rightsNo: rightsNo.value,
    logisticsCompanyCode: deliveryCompany.value.code,
    logisticsCompanyName: deliveryCompany.value.name,
    logisticsNo: trackingNo.value,
    remark: remark.value,
  }

  submitting.value = true
  try {
    const saveTrackingNo = isChange.value ? update : create
    await saveTrackingNo(params)
    showToast({
      message: '保存成功',
      icon: '',
    })
    setTimeout(() => {
      void wpi.navigateBack({
        delta: 1,
      })
    }, 1000)
  }
  finally {
    submitting.value = false
  }
}

async function onScanTap() {
  const response = await wpi.scanCode({
    scanType: ['barCode'],
  })
  trackingNo.value = response.result
  showToast({
    message: '扫码成功',
    icon: '',
  })
}

onLoad((query: QueryOptions = {}) => {
  void (async () => {
    const valid = await ensureRightsNo(query)
    if (!valid) {
      return
    }
    rightsNo.value = query.rightsNo ?? ''
    if (query.logisticsNo) {
      isChange.value = true
      trackingNo.value = query.logisticsNo
      remark.value = query.remark ?? ''
      deliveryCompany.value = {
        name: query.logisticsCompanyName ?? '',
        code: query.logisticsCompanyCode ?? '',
      }
      await wpi.setNavigationBarTitle({
        title: '修改运单号',
      })
    }
  })()
})

definePageJson({
  navigationBarTitleText: '填写运单号',
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-cell-group': 'tdesign-miniprogram/cell-group/cell-group',
    't-textarea': 'tdesign-miniprogram/textarea/textarea',
    't-input': 'tdesign-miniprogram/input/input',
    't-button': 'tdesign-miniprogram/button/button',
    'ui-reason-sheet': '../components/reason-sheet/index',
  },
})
</script>

<template>
  <view class="fill-tracking-no">
    <view class="notice-bar [padding:24rpx_30rpx] [text-align:center] [font-size:26rpx] [color:#e17349] [background:#fefcef]">
      请填写正确的退货包裹运单信息，以免影响退款进度
    </view>
    <view class="fill-tracking-no__form [margin-top:20rpx] [--td-input-vertical-padding:0] [&_.t-cell__note]:[justify-content:flex-start] [&_.t-cell__note]:[width:340rpx] [&_.t-cell__note]:[margin-left:10rpx] [&_.t-cell__value]:[color:#333] [&_.t-cell__value]:[font-size:30rpx] [&_.t-cell__value]:[text-align:left] [&_.t-cell__value]:[padding:0] [&_.t-cell__value_.t-textarea__wrapper]:[padding:0] [&_.t-input__control]:[font-size:30rpx] [&_.t-textarea__placeholder]:[font-size:30rpx] [&_.t-cell__placeholder]:[font-size:30rpx] [&_.t-textarea__placeholder]:[color:#bbbbbb] [&_.t-cell__placeholder]:[color:#bbbbbb] [&_.t-input__wrapper]:[margin:0]">
      <t-cell-group>
        <t-cell title="运单号" t-class-title="t-cell-title-width">
          <template #note>
            <t-input
              borderless
              t-class="t-cell__value"
              type="text"
              :value="trackingNo"
              maxlength="30"
              placeholder="请输入物流单号"
              data-key="trackingNo"
              @change="onInput"
            />
          </template>

          <template #right-icon>
            <t-icon name="scan" t-class="icon-scan" @tap="onScanTap" />
          </template>
        </t-cell>
        <t-cell
          t-class-title="t-cell-title-width"
          :t-class-note="deliveryCompany ? 't-cell__value' : 't-cell__placeholder'"
          title="物流公司"
          :note="deliveryCompanyLabel"
          arrow
          @tap="onCompanyTap"
        />
      </t-cell-group>
      <view class="textarea-wrapper [background:#fff] [display:flex] [align-items:flex-start] [padding:24rpx_32rpx_0_32rpx]">
        <text>备注信息</text>
      </view>
      <t-textarea
        t-class="t-textarea-wrapper [box-sizing:border-box]"
        type="text"
        :value="remark"
        maxlength="140"
        autosize
        placeholder="选填项，如有多个包裹寄回，请注明其运单信息"
        data-key="remark"
        @change="onInput"
      />
    </view>
    <view class="fill-tracking-no__button-bar [margin:38rpx_30rpx_0] [&_.btn]:[background-color:transparent] [&_.btn]:[font-size:32rpx] [&_.btn]:[width:100%] [&_.btn]:[border-radius:48rpx] [&_.btn:first-child]:[margin-bottom:20rpx] [&_.btn_.confirmBtn]:[background:#fa4126] [&_.btn_.confirmBtn]:[color:#fff] [&_.btn_.disabled]:[background-color:#c6c6c6] [&_.btn_.disabled]:[color:#fff]">
      <t-button
        :t-class="`btn ${submitActived ? 'confirmBtn' : ''}`"
        :disabled="!submitActived"
        :loading="submitting"
        @tap="onSubmit"
      >
        保存
      </t-button>
    </view>
  </view>
  <ui-reason-sheet id="wr-reason-sheet" />
</template>
