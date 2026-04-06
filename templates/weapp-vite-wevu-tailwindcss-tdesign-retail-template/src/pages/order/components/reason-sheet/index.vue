<script setup lang="ts">
import { ref } from 'wevu'
import { showToast } from '@/hooks/useToast'

export interface ReasonSheetOption {
  title: string
  checked?: boolean
}

interface ReasonSheetViewOption {
  title: string
  checked: boolean
}

interface ReasonSheetState {
  show?: boolean
  title?: string
  options?: ReasonSheetOption[]
  multiple?: boolean
  showConfirmButton?: boolean
  showCancelButton?: boolean
  showCloseButton?: boolean
  confirmButtonText?: string
  cancelButtonText?: string
  emptyTip?: string
}

type ReasonSheetConfirmHandler = (indexes: number[]) => void
type ReasonSheetCancelHandler = (reason?: unknown) => void

const visible = ref(false)
const title = ref('')
const multiple = ref(false)
const showConfirmButton = ref(false)
const showCancelButton = ref(false)
const showCloseButton = ref(false)
const confirmButtonText = ref('确定')
const cancelButtonText = ref('取消')
const emptyTip = ref('请选择')
const options = ref<ReasonSheetViewOption[]>([])
const checkedIndexes = ref<number[]>([])

let onConfirmHandler: ReasonSheetConfirmHandler | undefined
let onCancelHandler: ReasonSheetCancelHandler | undefined

function initOptions(nextOptions: ReasonSheetOption[] = [], isMultiple = false) {
  const nextCheckedIndexes: number[] = []
  const nextOptionsWithState = nextOptions.map((option, index) => {
    const checked = !!option.checked
    if (checked) {
      nextCheckedIndexes.push(index)
    }
    return {
      title: option.title,
      checked,
    }
  })

  checkedIndexes.value = isMultiple ? nextCheckedIndexes : nextCheckedIndexes.slice(0, 1)
  options.value = nextOptionsWithState.map((option, index) => ({
    ...option,
    checked: checkedIndexes.value.includes(index),
  }))
}

function open(state: ReasonSheetState) {
  title.value = state.title ?? ''
  multiple.value = !!state.multiple
  showConfirmButton.value = !!state.showConfirmButton
  showCancelButton.value = !!state.showCancelButton
  showCloseButton.value = !!state.showCloseButton
  confirmButtonText.value = state.confirmButtonText ?? '确定'
  cancelButtonText.value = state.cancelButtonText ?? '取消'
  emptyTip.value = state.emptyTip ?? '请选择'
  initOptions(state.options ?? [], multiple.value)
  visible.value = state.show ?? true
}

function bindHandlers(handlers: {
  onCancel?: ReasonSheetCancelHandler
  onConfirm?: ReasonSheetConfirmHandler
}) {
  onCancelHandler = handlers.onCancel
  onConfirmHandler = handlers.onConfirm
}

function close() {
  visible.value = false
}

function onOptionTap(event: { currentTarget?: { dataset?: { index?: number | string } } }) {
  const rawIndex = event.currentTarget?.dataset?.index
  const index = Number(rawIndex)
  if (!Number.isInteger(index) || !options.value[index]) {
    return
  }

  if (multiple.value) {
    const nextChecked = [...checkedIndexes.value]
    const exists = nextChecked.includes(index)
    checkedIndexes.value = exists
      ? nextChecked.filter(item => item !== index)
      : [...nextChecked, index]
    options.value = options.value.map((item, itemIndex) => ({
      ...item,
      checked: checkedIndexes.value.includes(itemIndex),
    }))
    return
  }

  if (checkedIndexes.value[0] === index) {
    return
  }

  checkedIndexes.value = [index]
  options.value = options.value.map((item, itemIndex) => ({
    ...item,
    checked: itemIndex === index,
  }))

  if (!showConfirmButton.value) {
    onConfirmHandler?.([index])
    close()
  }
}

function onCancel(reason?: unknown) {
  onCancelHandler?.(reason)
  close()
}

function onConfirm() {
  if (checkedIndexes.value.length === 0) {
    showToast({
      message: emptyTip.value,
      icon: '',
    })
    return
  }
  onConfirmHandler?.([...checkedIndexes.value])
  close()
}

function onVisibleChange(event: { detail?: { visible?: boolean } }) {
  if (event.detail?.visible === false) {
    onCancel('close')
  }
}

defineExpose({
  bindHandlers,
  open,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-icon': 'tdesign-miniprogram/icon/icon',
    't-popup': 'tdesign-miniprogram/popup/popup',
    't-cell': 'tdesign-miniprogram/cell/cell',
    't-button': 'tdesign-miniprogram/button/button',
  },
})
</script>

<template>
  <t-popup :visible="visible" placement="bottom" :close-btn="showCloseButton" @visible-change="onVisibleChange">
    <view class="popup-content [background-color:white] [color:#222427] [border-radius:20rpx_20rpx_0_0] [overflow:hidden] [&_.header]:[height:100rpx] [&_.header]:[line-height:100rpx] [&_.header]:[text-align:center] [&_.header]:[vertical-align:middle] [&_.header]:[font-size:32rpx] [&_.header]:[font-weight:bold] [&_.header]:[position:relative] [&_.options]:[max-height:60vh] [&_.options]:[overflow-y:scroll] [&_.options]:[-webkit-overflow-scrolling:touch] [&_.options_.cell]:[height:100rpx] [&_.options_.cell]:[align-items:center] [&_.options_.cell]:[font-size:30rpx] [&_.options_.cell]:[color:#333333] [&_.button-bar]:[width:100%] [&_.button-bar]:[padding:20rpx_30rpx] [&_.button-bar]:[display:flex] [&_.button-bar]:[flex-wrap:nowrap] [&_.button-bar]:[align-items:center] [&_.button-bar]:[justify-content:space-between] [&_.button-bar_.btn]:[width:100%] [&_.button-bar_.btn]:[background:#fa4126] [&_.button-bar_.btn]:[color:#fff] [&_.button-bar_.btn]:[border-radius:48rpx]">
      <view class="header">
        {{ title }}
      </view>
      <view class="options cell--noborder">
        <t-cell
          v-for="(item, index) in options"
          :key="`${item.title}-${index}`"
          t-class="cell"
          :title="item.title"
          :data-index="index"
          :border="false"
          @click="onOptionTap"
        >
          <template #right-icon>
            <view>
              <t-icon v-if="item.checked" name="check-circle-filled" size="36rpx" color="#fa4126" />
              <t-icon v-else name="circle" size="36rpx" color="#C7C7C7" />
            </view>
          </template>
        </t-cell>
      </view>
      <view v-if="showConfirmButton" class="button-bar [&_.btnWrapper]:[width:100%]">
        <t-button class="btnWrapper" t-class="btn" @tap="onConfirm">
          {{ confirmButtonText }}
        </t-button>
      </view>
      <view v-if="showCancelButton" class="[padding:0_30rpx_30rpx]">
        <t-button variant="text" @tap="onCancel()">
          {{ cancelButtonText }}
        </t-button>
      </view>
    </view>
  </t-popup>
</template>
