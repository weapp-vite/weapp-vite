<script setup lang="ts">
// import { getCommentDetail } from '../../../../services/good/comments/fetchCommentDetail';
import Toast from 'tdesign-miniprogram/toast/index';
defineOptions({
  data() {
    return {
      serviceRateValue: 1,
      goodRateValue: 1,
      conveyRateValue: 1,
      isAnonymous: false,
      uploadFiles: [],
      gridConfig: {
        width: 218,
        height: 218,
        column: 3
      },
      isAllowedSubmit: false,
      imgUrl: '',
      title: '',
      goodsDetail: '',
      imageProps: {
        mode: 'aspectFit'
      }
    };
  },
  onLoad(options) {
    this.setData({
      imgUrl: options.imgUrl,
      title: options.title,
      goodsDetail: options.specs
    });
  },
  onRateChange(e) {
    const {
      value
    } = e?.detail;
    const item = e?.currentTarget?.dataset?.item;
    this.setData({
      [item]: value
    }, () => {
      this.updateButtonStatus();
    });
  },
  onAnonymousChange(e) {
    const status = !!e?.detail?.checked;
    this.setData({
      isAnonymous: status
    });
  },
  handleSuccess(e) {
    const {
      files
    } = e.detail;
    this.setData({
      uploadFiles: files
    });
  },
  handleRemove(e) {
    const {
      index
    } = e.detail;
    const {
      uploadFiles
    } = this.data;
    uploadFiles.splice(index, 1);
    this.setData({
      uploadFiles
    });
  },
  onTextAreaChange(e) {
    const value = e?.detail?.value;
    this.textAreaValue = value;
    this.updateButtonStatus();
  },
  updateButtonStatus() {
    const {
      serviceRateValue,
      goodRateValue,
      conveyRateValue,
      isAllowedSubmit
    } = this.data;
    const {
      textAreaValue
    } = this;
    const temp = serviceRateValue && goodRateValue && conveyRateValue && textAreaValue;
    if (temp !== isAllowedSubmit) this.setData({
      isAllowedSubmit: temp
    });
  },
  onSubmitBtnClick() {
    const {
      isAllowedSubmit
    } = this.data;
    if (!isAllowedSubmit) return;
    Toast({
      context: this,
      selector: '#t-toast',
      message: '评价提交成功',
      icon: 'check-circle'
    });
    wx.navigateBack();
  }
});
</script>

<template>
<view class="page-container [&_.comment-card]:[padding:24rpx_32rpx_28rpx] [&_.comment-card]:[background-color:#ffffff] [&_.t-checkbox__bordered]:[display:none] [&_.anonymous-box]:[display:flex] [&_.anonymous-box]:[align-items:center] [&_.anonymous-box]:[padding-top:52rpx] [&_.anonymous-box_.name]:[font-size:28rpx] [&_.anonymous-box_.name]:[font-weight:normal] [&_.anonymous-box_.name]:[color:#999999] [&_.anonymous-box_.name]:[padding-left:28rpx] [&_.t-checkbox]:[padding:0rpx] [&_.t-checkbox__content]:[display:none] [&_.t-checkbox__icon-left]:[margin-right:0rpx] [&_.upload-container]:[margin-top:24rpx] [&_.t-upload__wrapper]:[border-radius:8rpx] [&_.t-upload__wrapper]:[overflow:hidden] [&_.submmit-bar]:[position:fixed] [&_.submmit-bar]:[left:0] [&_.submmit-bar]:[right:0] [&_.submmit-bar]:[bottom:0] [&_.submmit-bar]:[z-index:12] [&_.submmit-bar]:[padding:12rpx_32rpx] [&_.submmit-bar]:[padding-bottom:env(safe-area-inset-bottom)] [&_.submmit-bar]:[background-color:#fff] [&_.submmit-bar]:[height:112rpx] [&_.submmit-bar-button]:[border-radius:48rpx] [&_.submmit-bar-button]:[padding:0] [&_.t-upload__close-btn]:[background-color:rgba(0,_0,_0,_0.4)] [&_.t-upload__close-btn]:[border-bottom-left-radius:8rpx] [&_.t-upload__close-btn]:[width:36rpx] [&_.t-upload__close-btn]:[height:36rpx]">
  <view class="comment-card [&_.goods-info-container_.goods-image]:[width:112rpx] [&_.goods-info-container_.goods-image]:[height:112rpx] [&_.goods-info-container_.goods-image]:[border-radius:8rpx] [&_.goods-info-container]:[display:flex] [&_.goods-info-container]:[align-items:center] [&_.goods-info-container_.goods-title-container]:[padding-left:24rpx] [&_.goods-info-container_.goods-title]:[font-size:28rpx] [&_.goods-info-container_.goods-title]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[font-size:24rpx] [&_.goods-info-container_.goods-detail]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[color:#999999] [&_.goods-info-container_.goods-detail]:[margin-top:16rpx] [&_.rate-container]:[display:flex] [&_.rate-container]:[align-items:center] [&_.rate-container]:[margin-top:22rpx] [&_.rate-container_.rate-title]:[font-size:28rpx] [&_.rate-container_.rate-title]:[font-weight:bold] [&_.rate-container_.rate-title]:[margin-right:12rpx] [&_.textarea-container]:[margin-top:22rpx] [&_.textarea-container_.textarea]:[height:294rpx] [&_.textarea-container_.textarea]:[background-color:#f5f5f5] [&_.textarea-container_.textarea]:[border-radius:16rpx] [&_.textarea-container_.textarea]:[font-size:28rpx] [&_.textarea-container_.textarea]:[font-weight:normal] [&_.convey-comment-title]:[font-size:28rpx] [&_.convey-comment-title]:[font-weight:bold]">
    <view class="goods-info-container">
      <view class="goods-image-container">
        <t-image t-class="goods-image" src="{{imgUrl}}" />
      </view>
      <view class="goods-title-container">
        <view class="goods-title">{{title}}</view>
        <view class="goods-detail">{{goodsDetail}}</view>
      </view>
    </view>
    <view class="rate-container">
      <text class="rate-title">商品评价</text>
      <view class="rate">
        <t-rate
          value="{{goodRateValue}}"
          bind:change="onRateChange"
          size="26"
          gap="6"
          color="{{['#ffc51c', '#ddd']}}"
          data-item="goodRateValue"
        />
      </view>
    </view>
    <view class="textarea-container">
      <t-textarea
        t-class="textarea"
        maxlength="{{500}}"
        indicator
        placeholder="对商品满意吗？评论一下"
        bind:change="onTextAreaChange"
      />
    </view>
    <view class="upload-container [&_.upload-addcontent-slot]:[font-size:26rpx]">
      <t-upload
        media-type="{{['image','video']}}"
        files="{{uploadFiles}}"
        bind:remove="handleRemove"
        bind:success="handleSuccess"
        gridConfig="{{gridConfig}}"
        imageProps="{{imageProps}}"
      />
    </view>

    <view class="anonymous-box">
      <t-checkbox bind:change="onAnonymousChange" checked="{{isAnonymous}}" color="#FA4126" />
      <view class="name">匿名评价</view>
    </view>
  </view>
</view>
<view class="comment-card convey-card [background-color:#ffffff] [margin-top:24rpx] [padding:32rpx] [padding-bottom:calc(env(safe-area-inset-bottom)_+_140rpx)] [&_.goods-info-container_.goods-image]:[width:112rpx] [&_.goods-info-container_.goods-image]:[height:112rpx] [&_.goods-info-container_.goods-image]:[border-radius:8rpx] [&_.goods-info-container]:[display:flex] [&_.goods-info-container]:[align-items:center] [&_.goods-info-container_.goods-title-container]:[padding-left:24rpx] [&_.goods-info-container_.goods-title]:[font-size:28rpx] [&_.goods-info-container_.goods-title]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[font-size:24rpx] [&_.goods-info-container_.goods-detail]:[font-weight:normal] [&_.goods-info-container_.goods-detail]:[color:#999999] [&_.goods-info-container_.goods-detail]:[margin-top:16rpx] [&_.rate-container]:[display:flex] [&_.rate-container]:[align-items:center] [&_.rate-container]:[margin-top:22rpx] [&_.rate-container_.rate-title]:[font-size:28rpx] [&_.rate-container_.rate-title]:[font-weight:bold] [&_.rate-container_.rate-title]:[margin-right:12rpx] [&_.textarea-container]:[margin-top:22rpx] [&_.textarea-container_.textarea]:[height:294rpx] [&_.textarea-container_.textarea]:[background-color:#f5f5f5] [&_.textarea-container_.textarea]:[border-radius:16rpx] [&_.textarea-container_.textarea]:[font-size:28rpx] [&_.textarea-container_.textarea]:[font-weight:normal] [&_.convey-comment-title]:[font-size:28rpx] [&_.convey-comment-title]:[font-weight:bold] [&_.rate-container_.rate-title]:[font-weight:normal]">
  <view class="convey-comment-title">物流服务评价</view>
  <view class="rate-container">
    <text class="rate-title">物流评价</text>
    <view class="rate">
      <t-rate
        value="{{conveyRateValue}}"
        bind:change="onRateChange"
        variant="filled"
        size="26"
        gap="6"
        color="{{['#ffc51c', '#ddd']}}"
        data-item="conveyRateValue"
      />
    </view>
  </view>
  <view class="rate-container">
    <text class="rate-title">服务评价</text>
    <view class="rate">
      <t-rate
        value="{{serviceRateValue}}"
        bind:change="onRateChange"
        size="26"
        gap="6"
        color="{{['#ffc51c', '#ddd']}}"
        data-item="serviceRateValue"
      />
    </view>
  </view>
</view>
<view class="submit-button-container [padding:12rpx_32rpx] [display:flex] [width:100vw] [box-sizing:border-box] [justify-content:center] [position:fixed] [bottom:0] [padding-bottom:calc(env(safe-area-inset-bottom)_+_20rpx)] [background-color:#ffffff] [z-index:99]">
  <t-button
    content="提交"
    block
    shape="round"
    t-class="submit-button{{isAllowedSubmit ? '' : '-disabled'}}"
    bind:tap="onSubmitBtnClick"
  />
</view>
<t-toast id="t-toast" />
</template>

<json>
{
  "navigationBarTitleText": "评价商品",
  "usingComponents": {
    "t-image": "/components/webp-image/index",
    "t-rate": "tdesign-miniprogram/rate/rate",
    "t-textarea": "tdesign-miniprogram/textarea/textarea",
    "t-checkbox": "tdesign-miniprogram/checkbox/checkbox",
    "t-button": "tdesign-miniprogram/button/button",
    "t-upload": "tdesign-miniprogram/upload/upload",
    "t-icon": "tdesign-miniprogram/icon/icon",
    "t-toast": "tdesign-miniprogram/toast/toast"
  }
}</json>
