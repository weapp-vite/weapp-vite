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
  <view class="page-container [&_.comment-card]:[padding:24rpx_32rpx_28rpx] [&_.comment-card]:[background-color:#ffffff] [&_.t-checkbox__bordered]:[display:none] [&_.anonymous-box]:[display:flex] [&_.anonymous-box]:[align-items:center] [&_.anonymous-box]:[padding-top:52rpx] [&_.anonymous-box_.name]:[font-size:28rpx] [&_.anonymous-box_.name]:[font-weight:normal] [&_.anonymous-box_.name]:[color:#999999] [&_.anonymous-box_.name]:[padding-left:28rpx] [&_.t-checkbox]:[padding:0rpx] [&_.t-checkbox__content]:[display:none] [&_.t-checkbox__icon-left]:[margin-right:0rpx] [&_.upload-container]:[margin-top:24rpx] [&_.t-upload__wrapper]:[border-radius:8rpx] [&_.t-upload__wrapper]:[overflow:hidden] [&_.submmit-bar]:[position:fixed] [&_.submmit-bar]:[left:0] [&_.submmit-bar]:[right:0] [&_.submmit-bar]:[bottom:0] [&_.submmit-bar]:[z-index:12] [&_.submmit-bar]:[padding:12rpx_32rpx] [&_.submmit-bar]:[padding-bottom:env(safe-area-inset-bottom)] [&_.submmit-bar]:[background-color:#fff] [&_.submmit-bar]:[height:112rpx] [&_.submmit-bar-button]:[border-radius:48rpx] [&_.submmit-bar-button]:[padding:0] [&_.t-upload__close-btn]:[background-color:rgba(0,_0,_0,_0.4)] [&_.t-upload__close-btn]:[border-bottom-left-radius:8rpx] [&_.t-upload__close-btn]:[width:36rpx] [&_.t-upload__close-btn]:[height:36rpx]">
    <view class="comment-card [&_.goods-info-container_.goods-image]:[width:112rpx] [&_.goods-info-container_.goods-image]:[height:112rpx] [&_.goods-info-container_.goods-image]:[border-radius:8rpx] [&_.goods-info-container]:[display:flex] [&_.goods-info-container]:[align-items:center] [&_.goods-info-container_.goods-title-container]:[padding-left:24rpx] [&_.goods-info-container_.goods-title]:[font-size:28rpx] [&_.goods-info-container_.goods-title]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[font-size:24rpx] [&_.goods-info-container_.goods-detail]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[color:#999999] [&_.goods-info-container_.goods-detail]:[margin-top:16rpx] [&_.rate-container]:[display:flex] [&_.rate-container]:[align-items:center] [&_.rate-container]:[margin-top:22rpx] [&_.rate-container_.rate-title]:[font-size:28rpx] [&_.rate-container_.rate-title]:[font-weight:bold] [&_.rate-container_.rate-title]:[margin-right:12rpx] [&_.textarea-container]:[margin-top:22rpx] [&_.textarea-container_.textarea]:[height:294rpx] [&_.textarea-container_.textarea]:[background-color:#f5f5f5] [&_.textarea-container_.textarea]:[border-radius:16rpx] [&_.textarea-container_.textarea]:[font-size:28rpx] [&_.textarea-container_.textarea]:[font-weight:normal] [&_.convey-comment-title]:[font-size:28rpx] [&_.convey-comment-title]:[font-weight:bold]">
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
      <view class="upload-container [&_.upload-addcontent-slot]:[font-size:26rpx]">
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
  <view class="comment-card convey-card [background-color:#ffffff] [margin-top:24rpx] [padding:32rpx] [padding-bottom:calc(env(safe-area-inset-bottom)_+_140rpx)] [&_.goods-info-container_.goods-image]:[width:112rpx] [&_.goods-info-container_.goods-image]:[height:112rpx] [&_.goods-info-container_.goods-image]:[border-radius:8rpx] [&_.goods-info-container]:[display:flex] [&_.goods-info-container]:[align-items:center] [&_.goods-info-container_.goods-title-container]:[padding-left:24rpx] [&_.goods-info-container_.goods-title]:[font-size:28rpx] [&_.goods-info-container_.goods-title]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[font-size:24rpx] [&_.goods-info-container_.goods-detail]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[color:#999999] [&_.goods-info-container_.goods-detail]:[margin-top:16rpx] [&_.rate-container]:[display:flex] [&_.rate-container]:[align-items:center] [&_.rate-container]:[margin-top:22rpx] [&_.rate-container_.rate-title]:[font-size:28rpx] [&_.rate-container_.rate-title]:[font-weight:bold] [&_.rate-container_.rate-title]:[margin-right:12rpx] [&_.textarea-container]:[margin-top:22rpx] [&_.textarea-container_.textarea]:[height:294rpx] [&_.textarea-container_.textarea]:[background-color:#f5f5f5] [&_.textarea-container_.textarea]:[border-radius:16rpx] [&_.textarea-container_.textarea]:[font-size:28rpx] [&_.textarea-container_.textarea]:[font-weight:normal] [&_.convey-comment-title]:[font-size:28rpx] [&_.convey-comment-title]:[font-weight:bold] [&_.rate-container_.rate-title]:[font-weight:normal]">
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
  <view class="submit-button-container [padding:12rpx_32rpx] [display:flex] [width:100vw] [box-sizing:border-box] [justify-content:center] [position:fixed] [bottom:0] [padding-bottom:calc(env(safe-area-inset-bottom)_+_20rpx)] [background-color:#ffffff] [z-index:99]">
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
