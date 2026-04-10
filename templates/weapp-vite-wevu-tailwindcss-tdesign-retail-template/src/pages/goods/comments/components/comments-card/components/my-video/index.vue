<script setup lang="ts">
import { onMounted, ref, useNativeInstance } from 'wevu'
import { wpi } from 'wevu/api'

const props = withDefaults(defineProps<{
  videoSrc?: string
}>(), {
  videoSrc: '',
})

const emit = defineEmits<{
  play: [payload: any]
  ended: [payload: any]
  pause: [payload: any]
}>()

const nativeInstance = useNativeInstance()
const isShow = ref(true)
const fullScreen = ref(false)
let videoContext: WechatMiniprogram.VideoContext | null = null

onMounted(() => {
  videoContext = wpi.createVideoContext('myVideo', nativeInstance as any)
})

function bindplay(e: any) {
  isShow.value = false
  videoContext?.play()
  emit('play', e)
}

function bindplayByVideo(e: any) {
  isShow.value = false
  emit('play', e)
}

function bindended(e: any) {
  if (!fullScreen.value) {
    isShow.value = true
  }
  emit('ended', e)
}

function bindpause(e: any) {
  emit('pause', e)
}

function bindfullscreenchange(e: any) {
  fullScreen.value = !!e?.detail?.fullScreen
}

defineExpose({
  isShow,
  bindplay,
  bindplayByVideo,
  bindended,
  bindpause,
  bindfullscreenchange,
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
