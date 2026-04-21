<script setup lang="ts">
import { onLoad, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'
import { showToast } from '@/hooks/useToast'

interface UploadFileItem {
  [key: string]: any
}

const nativeInstance = useNativeInstance()

const serviceRateValue = ref(1)
const goodRateValue = ref(1)
const conveyRateValue = ref(1)
const isAnonymous = ref(false)
const uploadFiles = ref<UploadFileItem[]>([])
const gridConfig = ref({
  width: 218,
  height: 218,
  column: 3,
})
const isAllowedSubmit = ref(false)
const imgUrl = ref('')
const title = ref('')
const goodsDetail = ref('')
const imageProps = ref({
  mode: 'aspectFit',
})
const textAreaValue = ref('')

function updateButtonStatus() {
  isAllowedSubmit.value = !!(serviceRateValue.value && goodRateValue.value && conveyRateValue.value && textAreaValue.value)
}

function onRateChange(e: any) {
  const value = Number(e?.detail?.value ?? 1)
  const item = e?.currentTarget?.dataset?.item
  if (item === 'serviceRateValue') {
    serviceRateValue.value = value
  }
  else if (item === 'goodRateValue') {
    goodRateValue.value = value
  }
  else if (item === 'conveyRateValue') {
    conveyRateValue.value = value
  }
  updateButtonStatus()
}

function onAnonymousChange(e: any) {
  isAnonymous.value = !!e?.detail?.checked
}

function handleSuccess(e: any) {
  uploadFiles.value = e?.detail?.files || []
}

function handleRemove(e: any) {
  const index = Number(e?.detail?.index ?? -1)
  if (index < 0) {
    return
  }
  uploadFiles.value = uploadFiles.value.filter((_, fileIndex) => fileIndex !== index)
}

function onTextAreaChange(e: any) {
  textAreaValue.value = String(e?.detail?.value ?? '')
  updateButtonStatus()
}

async function onSubmitBtnClick() {
  if (!isAllowedSubmit.value) {
    return
  }
  showToast({
    context: nativeInstance as any,
    message: '评价提交成功',
    icon: 'check-circle',
  })
  await wpi.navigateBack({
    delta: 1,
  })
}

onLoad((options: Record<string, string | undefined> = {}) => {
  imgUrl.value = options.imgUrl || ''
  title.value = options.title || ''
  goodsDetail.value = options.specs || ''
})

definePageJson({
  navigationBarTitleText: '评价商品',
  usingComponents: {
    't-image': '/components/webp-image/index',
    't-rate': 'tdesign-miniprogram/rate/rate',
    't-textarea': 'tdesign-miniprogram/textarea/textarea',
    't-checkbox': 'tdesign-miniprogram/checkbox/checkbox',
    't-button': 'tdesign-miniprogram/button/button',
    't-upload': 'tdesign-miniprogram/upload/upload',
    't-icon': 'tdesign-miniprogram/icon/icon',
  },
})
</script>

<template>
  <view class="page-container [&_.comment-card]:p-[24rpx_32rpx_28rpx] [&_.comment-card]:bg-[#ffffff] [&_.t-checkbox__bordered]:hidden [&_.anonymous-box]:flex [&_.anonymous-box]:items-center [&_.anonymous-box]:pt-[52rpx] [&_.anonymous-box_.name]:text-[28rpx] [&_.anonymous-box_.name]:[font-weight:normal] [&_.anonymous-box_.name]:text-[#999999] [&_.anonymous-box_.name]:pl-[28rpx] [&_.t-checkbox]:p-0 [&_.t-checkbox__content]:hidden [&_.t-checkbox__icon-left]:mr-0 [&_.upload-container]:mt-[24rpx] [&_.t-upload__wrapper]:rounded-[8rpx] [&_.t-upload__wrapper]:overflow-hidden [&_.submmit-bar]:fixed [&_.submmit-bar]:inset-x-0 [&_.submmit-bar]:bottom-0 [&_.submmit-bar]:z-12 [&_.submmit-bar]:p-[12rpx_32rpx] [&_.submmit-bar]:pb-[env(safe-area-inset-bottom)] [&_.submmit-bar]:bg-white [&_.submmit-bar]:h-[112rpx] [&_.submmit-bar-button]:rounded-[48rpx] [&_.submmit-bar-button]:p-0 [&_.t-upload__close-btn]:bg-[rgba(0,0,0,0.4)] [&_.t-upload__close-btn]:rounded-bl-[8rpx] [&_.t-upload__close-btn]:size-[36rpx]">
    <view class="comment-card [&_.goods-info-container_.goods-image]:size-[112rpx] [&_.goods-info-container_.goods-image]:rounded-[8rpx] [&_.goods-info-container]:flex [&_.goods-info-container]:items-center [&_.goods-info-container_.goods-title-container]:pl-[24rpx] [&_.goods-info-container_.goods-title]:text-[28rpx] [&_.goods-info-container_.goods-title]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:text-[24rpx] [&_.goods-info-container_.goods-detail]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:text-[#999999] [&_.goods-info-container_.goods-detail]:mt-[16rpx] [&_.rate-container]:flex [&_.rate-container]:items-center [&_.rate-container]:mt-[22rpx] [&_.rate-container_.rate-title]:text-[28rpx] [&_.rate-container_.rate-title]:[font-weight:bold] [&_.rate-container_.rate-title]:mr-[12rpx] [&_.textarea-container]:mt-[22rpx] [&_.textarea-container_.textarea]:h-[294rpx] [&_.textarea-container_.textarea]:bg-[#f5f5f5] [&_.textarea-container_.textarea]:rounded-[16rpx] [&_.textarea-container_.textarea]:text-[28rpx] [&_.textarea-container_.textarea]:[font-weight:normal] [&_.convey-comment-title]:text-[28rpx] [&_.convey-comment-title]:[font-weight:bold]">
      <view class="goods-info-container">
        <view class="goods-image-container">
          <t-image t-class="goods-image" :src="imgUrl" />
        </view>
        <view class="goods-title-container">
          <view class="goods-title">
            {{ title }}
          </view>
          <view class="goods-detail">
            {{ goodsDetail }}
          </view>
        </view>
      </view>
      <view class="rate-container">
        <text class="rate-title">
          商品评价
        </text>
        <view class="rate">
          <t-rate
            :value="goodRateValue"
            size="26"
            gap="6"
            :color="['#ffc51c', '#ddd']"
            data-item="goodRateValue"
            @change="onRateChange"
          />
        </view>
      </view>
      <view class="textarea-container">
        <t-textarea
          t-class="textarea"
          :maxlength="500"
          indicator
          placeholder="对商品满意吗？评论一下"
          @change="onTextAreaChange"
        />
      </view>
      <view class="upload-container [&_.upload-addcontent-slot]:text-[26rpx]">
        <t-upload
          :media-type="['image', 'video']"
          :files="uploadFiles"
          :gridConfig="gridConfig"
          :imageProps="imageProps"
          @remove="handleRemove"
          @success="handleSuccess"
        />
      </view>

      <view class="anonymous-box">
        <t-checkbox :checked="isAnonymous" color="#FA4126" @change="onAnonymousChange" />
        <view class="name">
          匿名评价
        </view>
      </view>
    </view>
  </view>
  <view class="comment-card convey-card bg-[#ffffff] mt-[24rpx] p-[32rpx] pb-[calc(env(safe-area-inset-bottom)+140rpx)] [&_.goods-info-container_.goods-image]:size-[112rpx] [&_.goods-info-container_.goods-image]:rounded-[8rpx] [&_.goods-info-container]:flex [&_.goods-info-container]:items-center [&_.goods-info-container_.goods-title-container]:pl-[24rpx] [&_.goods-info-container_.goods-title]:text-[28rpx] [&_.goods-info-container_.goods-title]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:text-[24rpx] [&_.goods-info-container_.goods-detail]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:text-[#999999] [&_.goods-info-container_.goods-detail]:mt-[16rpx] [&_.rate-container]:flex [&_.rate-container]:items-center [&_.rate-container]:mt-[22rpx] [&_.rate-container_.rate-title]:text-[28rpx] [&_.rate-container_.rate-title]:[font-weight:bold] [&_.rate-container_.rate-title]:mr-[12rpx] [&_.textarea-container]:mt-[22rpx] [&_.textarea-container_.textarea]:h-[294rpx] [&_.textarea-container_.textarea]:bg-[#f5f5f5] [&_.textarea-container_.textarea]:rounded-[16rpx] [&_.textarea-container_.textarea]:text-[28rpx] [&_.textarea-container_.textarea]:[font-weight:normal] [&_.convey-comment-title]:text-[28rpx] [&_.convey-comment-title]:[font-weight:bold] [&_.rate-container_.rate-title]:[font-weight:normal]">
    <view class="convey-comment-title">
      物流服务评价
    </view>
    <view class="rate-container">
      <text class="rate-title">
        物流评价
      </text>
      <view class="rate">
        <t-rate
          :value="conveyRateValue"
          variant="filled"
          size="26"
          gap="6"
          :color="['#ffc51c', '#ddd']"
          data-item="conveyRateValue"
          @change="onRateChange"
        />
      </view>
    </view>
    <view class="rate-container">
      <text class="rate-title">
        服务评价
      </text>
      <view class="rate">
        <t-rate
          :value="serviceRateValue"
          size="26"
          gap="6"
          :color="['#ffc51c', '#ddd']"
          data-item="serviceRateValue"
          @change="onRateChange"
        />
      </view>
    </view>
  </view>
  <view class="submit-button-container p-[12rpx_32rpx] flex w-screen box-border justify-center fixed bottom-0 pb-[calc(env(safe-area-inset-bottom)+20rpx)] bg-[#ffffff] z-99">
    <t-button
      content="提交"
      block
      theme="primary"
      shape="round"
      :disabled="!isAllowedSubmit"
      @tap="onSubmitBtnClick"
    />
  </view>
</template>
