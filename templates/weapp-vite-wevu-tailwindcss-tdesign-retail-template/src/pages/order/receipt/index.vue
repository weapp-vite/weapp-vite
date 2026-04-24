<script setup lang="ts">
import { onLoad, ref } from 'wevu'
import { wpi } from 'wevu/api'
import { alertDialog } from '@/hooks/useDialog'
import { showToast } from '@/hooks/useToast'
import { dispatchSupplementInvoice } from '../../../services/order/orderConfirm'

interface LabelItem {
  title: string
  id: number
  name: 'receipt' | 'addressTags' | 'goodsClasses'
  type?: number
}

interface InvoiceDraft {
  invoiceType?: number
  buyerName?: string
  email?: string
  buyerPhone?: string
  titleType?: number
  contentType?: number
  buyerTaxNo?: string
}

interface QueryOptions {
  orderNo?: string
  invoiceData?: string
}

interface LabelEvent {
  currentTarget?: {
    dataset?: {
      item?: LabelItem
    }
  }
}

interface InputEvent {
  currentTarget?: {
    dataset?: {
      item?: 'name' | 'code' | 'email'
    }
  }
  detail?: {
    value?: string
  }
}

const invoiceInfo = {
  info: ['1.根据当地税务局的要求，开具有效的企业发票需填写税务局登记证号。开具个人发票不需要填写纳税人识别码。 ', '2.电子普通发票： 电子普通发票是税局认可的有效首付款凭证，其法律效力、基本用途及使用规定同纸质发票，如需纸质发票可自行下载打印。 ', '3.增值税专用发票： 增值税发票暂时不可开，可查看《开局增值税发票》或致电400-633-6868。'],
  codeTitle: ['1.什么是纳税人识别号/统一社会信用代码？ 纳税人识别号，一律由15位、17位、18或者20位码（字符型）组成，其中：企业、事业单位等组织机构纳税人，以国家质量监督检验检疫总局编制的9位码（其中区分主码位与校检位之间的“—”符省略不打印）并在其“纳税人识别号”。国家税务总局下达的纳税人代码为15位，其中：1—2位为省、市代码，3—6位为地区代码，7—8位为经济性质代码，9—10位行业代码，11—15位为各地区自设的顺序码。', '2.入户获取/知晓纳税人识别号/统一社会信用代码？ 纳税人识别号是税务登记证上的号码，通常简称为“税号”，每个企业的纳税人识别号都是唯一的。这个属于每个人自己且终身不变的数字代码很可能成为我们的第二张“身份证”。  '],
}

const orderNo = ref('')
const submitting = ref(false)
const receiptIndex = ref(0)
const addressTagsIndex = ref(0)
const goodsClassesIndex = ref(0)
const dialogShow = ref(false)
const codeShow = ref(false)
const receipts = ref<LabelItem[]>([
  {
    title: '不开发票',
    id: 0,
    name: 'receipt',
  },
  {
    title: '电子发票',
    id: 1,
    name: 'receipt',
  },
])
const addressTags = ref<LabelItem[]>([
  {
    title: '个人',
    id: 0,
    name: 'addressTags',
    type: 1,
  },
  {
    title: '公司',
    id: 1,
    name: 'addressTags',
    type: 2,
  },
])
const goodsClasses = ref<LabelItem[]>([
  {
    title: '商品明细',
    id: 0,
    name: 'goodsClasses',
  },
  {
    title: '商品类别',
    id: 1,
    name: 'goodsClasses',
  },
])
const name = ref('')
const componentName = ref('')
const code = ref('')
const phone = ref('')
const email = ref('')

function parseInvoiceData(rawValue?: string) {
  try {
    return JSON.parse(rawValue || '{}') as InvoiceDraft
  }
  catch {
    return {}
  }
}

function onLabels(event: LabelEvent) {
  const item = event.currentTarget?.dataset?.item
  if (!item) {
    return
  }
  if (item.name === 'receipt') {
    receiptIndex.value = item.id
    return
  }
  if (item.name === 'addressTags') {
    addressTagsIndex.value = item.id
    return
  }
  goodsClassesIndex.value = item.id
}

function onInput(event: InputEvent) {
  const item = event.currentTarget?.dataset?.item
  const value = event.detail?.value ?? ''
  if (!item) {
    return
  }
  if (item === 'name') {
    if (addressTagsIndex.value === 0) {
      name.value = value
    }
    else {
      componentName.value = value
    }
    return
  }
  if (item === 'code') {
    if (addressTagsIndex.value === 0) {
      phone.value = value
    }
    else {
      code.value = value
    }
    return
  }
  email.value = value
}

function checkSure() {
  if (receiptIndex.value === 0) {
    return true
  }
  if (addressTagsIndex.value === 0) {
    if (!name.value.length || !phone.value.length) {
      return false
    }
  }
  else if (!componentName.value.length || !code.value.length) {
    return false
  }
  return !!email.value.length
}

async function onSure() {
  const result = checkSure()
  if (!result) {
    await alertDialog({
      title: '请填写发票信息',
      content: '',
      confirmBtn: '确认',
    })
    return
  }

  const data = {
    buyerName: addressTagsIndex.value === 0 ? name.value : componentName.value,
    buyerTaxNo: code.value,
    buyerPhone: phone.value,
    email: email.value,
    titleType: addressTags.value[addressTagsIndex.value]?.type ?? 1,
    contentType: goodsClassesIndex.value === 0 ? 1 : 2,
    invoiceType: receiptIndex.value === 1 ? 5 : 0,
  }

  if (orderNo.value) {
    if (submitting.value) {
      return
    }
    submitting.value = true
    try {
      await dispatchSupplementInvoice({
        parameter: {
          orderNo: orderNo.value,
          invoiceVO: data,
        },
      } as any)
      showToast({
        message: '保存成功',
        duration: 2000,
        icon: '',
      })
      setTimeout(() => {
        submitting.value = false
        void wpi.navigateBack({
          delta: 1,
        })
      }, 1000)
    }
    catch (error) {
      submitting.value = false
      console.error(error)
    }
    return
  }

  wpi.setStorageSync('invoiceData', {
    ...data,
    receipts: receipts.value[receiptIndex.value],
    addressTags: addressTags.value[addressTagsIndex.value],
  })
  await wpi.navigateBack({
    delta: 1,
  })
}

function onDialogTap() {
  dialogShow.value = !dialogShow.value
  codeShow.value = false
}

function onKnowCode() {
  dialogShow.value = !dialogShow.value
  codeShow.value = true
}

onLoad((query: QueryOptions = {}) => {
  const tempData = parseInvoiceData(query.invoiceData)
  orderNo.value = query.orderNo ?? ''
  receiptIndex.value = tempData.invoiceType === 5 ? 1 : 0
  name.value = tempData.buyerName || ''
  email.value = tempData.email || ''
  phone.value = tempData.buyerPhone || ''
  addressTagsIndex.value = tempData.titleType === 2 ? 1 : 0
  goodsClassesIndex.value = tempData.contentType === 2 ? 1 : 0
  code.value = tempData.buyerTaxNo || ''
  componentName.value = tempData.titleType === 2 ? tempData.buyerName || '' : ''
})

definePageJson({
  navigationBarTitleText: '发票',
  usingComponents: {
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-dialog': 'tdesign-miniprogram/dialog/dialog',
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-input': 'tdesign-miniprogram/input/input',
    't-button': 'tdesign-miniprogram/button/button',
  },
})
</script>

<template>
  <view class="receipt h-screen [background:#f5f5f5] relative pt-[20rpx] [&_.t-input__wrapper]:m-0 [&_.flex]:flex [&_.flex]:items-center [&_.flex]:justify-between [&_.head-title]:text-[#333] [&_.head-title]:text-[30rpx] [&_.head-title]:[font-weight:bold] [&_.btn-wrap]:flex [&_.btn-wrap_.btn]:w-[128rpx] [&_.btn-wrap_.btn]:[background:#f5f5f5] [&_.btn-wrap_.btn]:text-[24rpx] [&_.btn-wrap_.btn]:text-[#333] [&_.btn-wrap_.btn]:mr-[22rpx] [&_.btn-wrap_.btn]:text-center [&_.btn-wrap_.btn]:rounded-[8rpx] [&_.btn-wrap_.btn]:relative [&_.btn-wrap_.btn]:[border:2rpx_solid_#f5f5f5] [&_.btn-wrap_.active-btn]:bg-transparent [&_.btn-wrap_.active-btn]:border-[#fa4126] [&_.btn-wrap_.active-btn]:text-[#fa4126] [&_.title]:w-full [&_.title]:bg-white [&_.title]:mb-[20rpx] [&_.receipt-label]:flex [&_.receipt-label_.btn]:w-[128rpx] [&_.receipt-label_.btn]:[background:#f5f5f5] [&_.receipt-label_.btn]:text-[24rpx] [&_.receipt-label_.btn]:text-[#333] [&_.receipt-label_.btn]:ml-[22rpx] [&_.receipt-label_.btn]:text-center [&_.receipt-label_.btn]:rounded-[8rpx] [&_.receipt-label_.btn]:[border:2rpx_solid_#f5f5f5] [&_.receipt-label_.active-btn]:bg-transparent [&_.receipt-label_.active-btn]:border-[#fa4126] [&_.receipt-label_.active-btn]:text-[#fa4126] [&_.receipt-label_.wr-cell__title]:text-[30rpx] [&_.receipt-label_.wr-cell__title]:text-[#333] [&_.receipt-label_.wr-cell__title]:[font-weight:bold] [&_.receipt-content]:[background:#fff] [&_.receipt-content]:mt-[20rpx] [&_.receipt-content_.addressTags]:p-[0_30rpx] [&_.receipt-content_.addressTags]:h-[100rpx] [&_.receipt-content_.addressTags_.btn-wrap]:flex [&_.receipt-content_.line]:w-[720rpx] [&_.receipt-content_.line]:ml-[30rpx] [&_.receipt-content_.line]:bg-[#e6e6e6] [&_.receipt-content_.line]:h-[1rpx] [&_.receipt-content_.receipt-input]:flex [&_.receipt-content_.receipt-input]:p-[0_30rpx] [&_.receipt-content_.receipt-input]:items-center [&_.receipt-content_.receipt-input]:h-[100rpx] [&_.receipt-content_.receipt-input]:text-[#666] [&_.receipt-content_.receipt-input_.title]:text-[#333] [&_.receipt-content_.receipt-input_.title]:inline-block [&_.receipt-content_.receipt-input_.title]:w-[140rpx] [&_.receipt-content_.receipt-input_.title]:mr-[30rpx] [&_.receipt-content_.receipt-input_.title]:text-[30rpx] [&_.receipt-content_.receipt-input_.title]:[font-weight:bold] [&_.receipt-content_.receipt-input_.wr-icon]:text-[28rpx] [&_.receipt-content_.receipt-input_.wr-icon]:ml-[20rpx] [&_.receipt-info]:[background:#fff] [&_.receipt-info]:mt-[20rpx] [&_.receipt-info_.info-con]:p-[0_30rpx] [&_.receipt-info_.info-con]:h-[100rpx] [&_.receipt-info_.title]:text-[24rpx] [&_.receipt-info_.title]:text-[#999999] [&_.receipt-info_.title]:leading-[36rpx] [&_.receipt-info_.title]:p-[0_30rpx_20rpx] [&_.receipt-info_.title]:box-border [&_.receipt-know]:flex [&_.receipt-know]:items-center [&_.receipt-know]:text-[26rpx] [&_.receipt-know]:font-normal [&_.receipt-know]:text-[#999999] [&_.receipt-know]:p-[20rpx_30rpx] [&_.receipt-know]:leading-[26rpx] [&_.receipt-know_.icon]:ml-[16rpx] [&_.receipt-know_.icon]:text-[26rpx] [&_.dialog-receipt_.dialog__message]:p-0 [&_.dialog-receipt_.dialog-info]:max-h-[622rpx] [&_.dialog-receipt_.info-wrap]:p-[0_18rpx] [&_.dialog-receipt_.info_.title]:inline-block [&_.dialog-receipt_.info_.title]:text-[28rpx] [&_.dialog-receipt_.info_.title]:font-normal [&_.dialog-receipt_.info_.title]:text-[#999] [&_.dialog-receipt_.info_.title]:leading-[40rpx] [&_.dialog-receipt_.info_.title]:mb-[40rpx] [&_.dialog-receipt_.info_.title]:text-left [&_.receipt-btn]:fixed [&_.receipt-btn]:bottom-0 [&_.receipt-btn]:left-0 [&_.receipt-btn]:right-0 [&_.receipt-btn]:z-100 [&_.receipt-btn]:[background:#fff] [&_.receipt-btn]:w-full [&_.receipt-btn]:p-[0_20rpx] [&_.receipt-btn]:box-border [&_.receipt-btn]:pb-[calc(20rpx+env(safe-area-inset-bottom))] [&_.receipt-btn_.receipt-btn-con]:mt-[20rpx] [&_.receipt-btn_.receipt-btn-con]:inline-block [&_.receipt-btn_.receipt-btn-con]:w-full [&_.receipt-btn_.receipt-btn-con]:leading-[80rpx] [&_.receipt-btn_.receipt-btn-con]:[background:#fa4126] [&_.receipt-btn_.receipt-btn-con]:text-center [&_.receipt-btn_.receipt-btn-con]:text-white [&_.receipt-btn_.receipt-btn-con]:rounded-[48rpx]">
    <view class="title">
      <t-cell class="receipt-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none" title="发票" :bordered="false" t-class-left="cell-left">
        <template #right-icon>
          <view class="btn-wrap">
            <view
              v-for="(item, index) in receipts"
              :key="index"
              :data-item="item"
              :class="`btn ${receiptIndex === index ? 'active-btn' : ''}`"
              @tap="onLabels"
            >
              {{ item.title }}
            </view>
          </view>
        </template>
      </t-cell>
    </view>
    <block v-if="receiptIndex === 1">
      <t-cell class="receipt-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none" title="发票抬头" t-class-left="cell-left">
        <template #right-icon>
          <view class="btn-wrap">
            <view
              v-for="(tag, index) in addressTags"
              :key="index"
              :class="`btn ${addressTagsIndex === index ? 'active-btn' : ''}`"
              :data-item="tag"
              @tap="onLabels"
            >
              {{ tag.title }}
            </view>
          </view>
        </template>
      </t-cell>
      <t-cell
        class="receipt-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none"
        :title="addressTagsIndex === 0 ? '姓名' : '公司名称'"
        t-class-left="cell-left"
        t-class-right="cell-right"
      >
        <template #right-icon>
          <t-input
            borderless
            t-class="input-com [display:inline-block] [flex:1] [font-size:30rpx] [font-weight:400] [line-height:30rpx] ![padding:0] [color:#666]"
            :value="addressTagsIndex === 0 ? name : componentName"
            data-item="name"
            type=""
            :placeholder="addressTagsIndex === 0 ? '请输入您的姓名' : '请输入公司名称'"
            @change="onInput"
          />
        </template>
      </t-cell>
      <t-cell
        class="receipt-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none"
        :title="addressTagsIndex === 0 ? '手机号' : '识别号'"
        t-class-left="cell-left"
        t-class-right="cell-right"
      >
        <template #right-icon>
          <view class="addressTagsIndex-cell flex items-center justify-between w-full">
            <t-input
              t-class="input-com [display:inline-block] [flex:1] [font-size:30rpx] [font-weight:400] [line-height:30rpx] ![padding:0] [color:#666]"
              borderless
              :value="addressTagsIndex === 0 ? phone : code"
              data-item="code"
              type=""
              :placeholder="addressTagsIndex === 0 ? '请输入您的手机号' : '请输入纳税人识别号'"
              @change="onInput"
            />
            <t-icon v-if="addressTagsIndex === 1" name="help-circle" size="30rpx" @tap="onKnowCode" />
          </view>
        </template>
      </t-cell>
      <t-cell
        class="receipt-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none"
        title="电子邮箱"
        :bordered="false"
        t-class-left="cell-left"
        t-class-right="cell-right"
      >
        <template #right-icon>
          <t-input
            t-class="input-com [display:inline-block] [flex:1] [font-size:30rpx] [font-weight:400] [line-height:30rpx] ![padding:0] [color:#666]"
            borderless
            :value="email"
            data-item="email"
            type=""
            placeholder="请输入邮箱用于接收电子发票"
            @change="onInput"
          />
        </template>
      </t-cell>
      <view class="receipt-info">
        <t-cell class="receipt-cell [&_.t-cell__title]:w-[144rpx] [&_.t-cell__title]:pr-[32rpx] [&_.t-cell__title]:flex-none" title="发票内容" :bordered="false" t-class-left="cell-left">
          <template #right-icon>
            <view class="btn-wrap">
              <view
                v-for="(good, index) in goodsClasses"
                :key="index"
                :class="`btn ${goodsClassesIndex === index ? 'active-btn' : ''}`"
                :data-item="good"
                @tap="onLabels"
              >
                {{ good.title }}
              </view>
            </view>
          </template>
        </t-cell>
        <view class="title">
          发票内容将显示详细商品名称与价格信息，发票金额为实际支付金额，不包含优惠等扣减金额
        </view>
      </view>
      <view class="receipt-know" @tap="onDialogTap">
        发票须知
        <t-icon name="help-circle" size="30rpx" />
      </view>
      <t-dialog
        :title="codeShow ? '纳税人识别号说明' : '发票须知'"
        class="dialog-receipt"
        :visible="dialogShow"
        confirm-btn="我知道了"
        @confirm="onDialogTap"
      >
        <template #content>
          <view class="srcoll-view-wrap mt-[20rpx]">
            <scroll-view class="dialog-info" :scroll-x="false" :scroll-y="true">
              <view class="info-wrap">
                <view v-if="!codeShow" class="info">
                  <view v-for="(item, index) in invoiceInfo.info" :key="index" class="title">
                    {{ item }}
                  </view>
                </view>
                <view v-else class="info">
                  <view v-for="(item, index) in invoiceInfo.codeTitle" :key="index" class="title">
                    {{ item }}
                  </view>
                </view>
              </view>
            </scroll-view>
          </view>
        </template>
      </t-dialog>
    </block>
    <view v-else />
    <view class="safe-area-bottom receipt-btn">
      <t-button t-class="receipt-btn-con" @tap="onSure">
        确定
      </t-button>
    </view>
  </view>
</template>
