<script setup lang="ts">
// @ts-nocheck
defineOptions({
  externalClasses: ['my-video', 'my-cover-img', 'my-play-icon'],
  properties: {
    videoSrc: {
      type: String,
    },
  },
  data() {
    return {
      isShow: true,
    }
  },
  options: {
    multipleSlots: true, // 在组件定义时的选项中启用多slot支持
  },
  attached() {
    this.videoContext = wx.createVideoContext('myVideo', this)
  },
  fullScreen: false,
  methods: {
    // 点击封面自定义播放按钮时触发
    bindplay(e) {
      this.setData({
        isShow: false,
      })
      this.videoContext.play()
      this.triggerEvent('play', e)
    },
    bindplayByVideo(e) {
      this.setData({
        isShow: false,
      })
      this.triggerEvent('play', e)
    },
    // 监听播放到末尾时触发
    bindended(e) {
      if (!this.fullScreen) {
        this.setData({
          isShow: true,
        })
      }
      this.triggerEvent('ended', e)
    },
    // 监听暂停播放时触发
    bindpause(e) {
      this.triggerEvent('pause', e)
    },
    bindfullscreenchange(e) {
      const fullScreen = e?.detail?.fullScreen
      this.fullScreen = fullScreen
    },
  },
})

defineComponentJson({
  component: true,
  usingComponents: {},
})
</script>

<template>
  <video
    id="myVideo"
    :src="videoSrc"
    enable-danmu
    controls
    show-fullscreen-btn
    :show-center-play-btn="false"
    auto-pause-if-navigate
    auto-pause-if-open-native
    show-play-btn
    object-fit="contain"
    class="video my-video [display:flex] [&_.video_cover]:[width:100%] [&_.video_cover]:[height:100%] [&_.video_cover]:[position:relative] [&_.video_play_icon]:[position:absolute] [&_.video_play_icon]:[left:50%] [&_.video_play_icon]:[top:50%] [&_.video_play_icon]:[transform:translate(-50%,_-50%)] [&_.video_play_icon]:[z-index:5] [&_.video_txt]:[margin:10rpx_auto]"
    @pause="bindpause"
    @ended="bindended"
    @play="bindplayByVideo"
    @fullscreenchange="bindfullscreenchange"
  >
    <view v-if="isShow" class="video_cover">
      <view class="my-cover-img">
        <slot name="cover-img" />
      </view>
      <view class="video_play_icon my-play-icon" @tap="bindplay">
        <slot name="play-icon" />
      </view>
    </view>
  </video>
</template>
