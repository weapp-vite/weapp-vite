<script setup lang="ts">
interface CommentResource {
  type?: 'image' | 'video' | string
  src?: string
  coverSrc?: string
}

const props = withDefaults(defineProps<{
  goodsDetailInfo?: string
  sellerReply?: string
  userHeadUrl?: string
  userName?: string
  commentContent?: string
  commentScore?: number
  commentTime?: string
  commentResources?: CommentResource[]
}>(), {
  goodsDetailInfo: '',
  sellerReply: '',
  userHeadUrl: '',
  userName: '',
  commentContent: '',
  commentScore: 0,
  commentTime: '',
  commentResources: () => [],
})

defineExpose({
  props,
})

defineComponentJson({
  component: true,
  usingComponents: {
    't-rate': 'tdesign-miniprogram/rate/rate',
    'images-videos': './components/images-videos',
    't-image': '/components/webp-image/index',
  },
})
</script>

<template>
  <view class="comments-card-item wr-class p-[32rpx] flex bg-white relative">
    <view class="comments-card-item-container w-full [&_.comments-title]:flex [&_.comments-title]:items-center [&_.comments-title]:relative [&_.comments-card-reply]:bg-[#f5f5f5] [&_.comments-card-reply]:p-[24rpx_16rpx] [&_.comments-card-reply]:mt-[24rpx] [&_.comments-card-reply_.prefix]:text-[26rpx] [&_.comments-card-reply_.prefix]:[font-weight:bold] [&_.comments-card-reply_.prefix]:text-[#666666] [&_.comments-card-reply_.content]:text-[26rpx] [&_.comments-card-reply_.content]:text-[#666666]">
      <view class="comments-title [&_.userName]:text-[26rpx] [&_.userName]:text-[#333333] [&_.userName]:ml-[24rpx] [&_.commentTime]:text-[24rpx] [&_.commentTime]:text-[#999999] [&_.commentTime]:absolute [&_.commentTime]:right-0">
        <view class="comments-card-item__avatar flex [&_.comments-card-item__user-img]:size-[64rpx] [&_.comments-card-item__user-img]:rounded-[50%]">
          <t-image t-class="comments-card-item__user-img" :src="userHeadUrl" />
        </view>
        <view class="comments-card-item__user-name">
          {{ userName }}
        </view>
        <text class="comments-card-item__time">
          {{ commentTime }}
        </text>
      </view>
      <view class="comments-info flex items-center mt-[18rpx] [&_.rate]:mr-[24rpx] [&_.goods-info-text]:text-[24rpx] [&_.goods-info-text]:text-[#999999]">
        <view class="rate">
          <t-rate :value="commentScore" size="14" gap="2" :color="['#ffc51c', '#ddd']" />
        </view>
        <view v-if="goodsDetailInfo" class="goods-info-text">
          {{ goodsDetailInfo }}
        </view>
      </view>
      <view class="comments-card-item-container-content mt-[16rpx] relative [&_.content-text]:text-[28rpx] [&_.content-text]:whitespace-normal [&_.content-text]:break-all [&_.content-text]:[font-weight:normal] [&_.hide-text]:line-clamp-5 [&_.hide-text]:text-ellipsis [&_.hide-text]:text-justify [&_.showMore]:absolute [&_.showMore]:w-[112rpx] [&_.showMore]:h-[36rpx] [&_.showMore]:bottom-0 [&_.showMore]:right-0 [&_.showMore]:[background:linear-gradient(to_right,rgba(255,255,255,0.2)_0,rgba(255,255,255,0.45)_20%,rgba(255,255,255,0.7)_25%,rgba(255,255,255,0.9)_30%,rgba(255,255,255,0.95)_35%,#ffffff_50%,#fff_100%)] [&_.showMore]:text-[26rpx] [&_.showMore]:text-[#fa550f] [&_.showMore]:leading-[36rpx] [&_.showMore]:text-right">
        <view class="content-text">
          {{ commentContent }}
        </view>
      </view>
      <view v-if="commentResources.length > 0" class="comments-card-item-container-image mt-[24rpx] flex justify-between flex-wrap [&_.commentImg]:rounded-[8rpx] [&_.commentImg]:mt-[12rpx] [&_.commentImg3]:size-[196rpx] [&_.commentImg2]:size-[300rpx] [&_.commentImg1]:size-[404rpx]">
        <images-videos :resources="commentResources" />
      </view>
      <view v-if="sellerReply" class="comments-card-reply">
        <text class="prefix">
          店家回复：
        </text>
        <text class="content">
          {{ sellerReply }}
        </text>
      </view>
    </view>
  </view>
</template>

<style>
.comments-card-item {
  position: relative;
  box-sizing: border-box;
  display: flex;
  width: 100%;
  padding: 32rpx;
  background: #fff;
}

.comments-card-item-container {
  width: 100%;
}

.comments-title {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 64rpx;
  padding-right: 210rpx;
}

.comments-card-item__avatar {
  display: flex;
  flex-shrink: 0;
  width: 64rpx;
  height: 64rpx;
  overflow: hidden;
  border-radius: 50%;
}

.comments-card-item__user-img {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
}

.comments-card-item__user-name {
  margin-left: 24rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 26rpx;
  line-height: 36rpx;
  color: #333;
  white-space: nowrap;
}

.comments-card-item__time {
  position: absolute;
  right: 0;
  font-size: 24rpx;
  line-height: 34rpx;
  color: #999;
}

.comments-info {
  display: flex;
  align-items: center;
  margin-top: 18rpx;
}

.rate {
  margin-right: 24rpx;
}

.goods-info-text {
  font-size: 24rpx;
  line-height: 34rpx;
  color: #999;
}

.comments-card-item-container-content {
  position: relative;
  margin-top: 16rpx;
}

.content-text {
  font-size: 28rpx;
  font-weight: normal;
  line-height: 42rpx;
  color: #111;
  word-break: break-all;
  white-space: normal;
}

.comments-card-item-container-image {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  margin-top: 24rpx;
}

.comments-card-reply {
  box-sizing: border-box;
  padding: 24rpx 16rpx;
  margin-top: 24rpx;
  background: #f5f5f5;
}

.comments-card-reply .prefix {
  font-size: 26rpx;
  font-weight: bold;
  line-height: 38rpx;
  color: #666;
}

.comments-card-reply .content {
  font-size: 26rpx;
  line-height: 38rpx;
  color: #666;
}
</style>
