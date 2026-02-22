<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs } from 'wevu'

interface SwipeoutController {
  close: () => void
}

defineOptions({
  setupLifecycle: 'created',
  externalClasses: ['wr-class'],
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(defineProps<{
  disabled?: boolean
  leftWidth?: number
  rightWidth?: number
  asyncClose?: boolean
}>(), {
  disabled: false,
  leftWidth: 0,
  rightWidth: 0,
  asyncClose: false,
})

const emit = defineEmits<{
  click: [position: string]
  close: [payload: { position: string, instance: SwipeoutController }]
}>()

function getSwipeoutInstances() {
  const globalStore = globalThis as any
  if (!Array.isArray(globalStore.__WEVU_SWIPEOUT_INSTANCES__)) {
    globalStore.__WEVU_SWIPEOUT_INSTANCES__ = []
  }
  return globalStore.__WEVU_SWIPEOUT_INSTANCES__ as SwipeoutController[]
}

const { disabled, leftWidth, rightWidth } = toRefs(props)
const closed = ref(true)

function close() {
  closed.value = true
}

const controller: SwipeoutController = {
  close,
}

function open(position: string) {
  closed.value = false
  emit('close', {
    position,
    instance: controller,
  })
}

function closeOther() {
  const instances = getSwipeoutInstances()
  instances.filter(item => item !== controller).forEach(item => item.close())
}

function noop() {
  return undefined
}

function onClick(event: any) {
  const { key: position = 'outside' } = event.currentTarget.dataset
  emit('click', position)
  if (closed.value) {
    return
  }
  if (props.asyncClose) {
    emit('close', {
      position,
      instance: controller,
    })
  }
  else {
    close()
  }
}

defineExpose({
  disabled,
  leftWidth,
  rightWidth,
  closed,
  open,
  close,
  closeOther,
  noop,
  onClick,
})

onMounted(() => {
  getSwipeoutInstances().push(controller)
})

onUnmounted(() => {
  const instances = getSwipeoutInstances()
  const globalStore = globalThis as any
  globalStore.__WEVU_SWIPEOUT_INSTANCES__ = instances.filter(item => item !== controller)
})
</script>

<template>
  <wxs src="./swipe.wxs" module="swipe" />

  <view
    class="wr-class wr-swipeout [position:relative] [overflow:hidden]"
    data-key="cell"
    capture-bind:tap="onClick"
    bindtouchstart="{{disabled || swipe.startDrag}}"
    capture-bind:touchmove="{{disabled || swipe.onDrag}}"
    bindtouchend="{{disabled || swipe.endDrag}}"
    bindtouchcancel="{{disabled || swipe.endDrag}}"
    closed="{{closed}}"
    change:closed="{{swipe.onCloseChange}}"
    leftWidth="{{leftWidth}}"
    rightWidth="{{rightWidth}}"
    change:leftWidth="{{swipe.initLeftWidth}}"
    change:rightWidth="{{swipe.initRightWidth}}"
  >
    <view id="wrapper">
      <view wx:if="{{ leftWidth }}" class="wr-swipeout__left [position:absolute] [top:0] [height:100%] [left:0] [transform:translate3d(-100%,_0,_0)]" data-key="left" catch:tap="onClick">
        <slot name="left" />
      </view>
      <slot />
      <view wx:if="{{ rightWidth }}" class="wr-swipeout__right [position:absolute] [top:0] [height:100%] [right:0] [transform:translate3d(100%,_0,_0)]" data-key="right" catch:tap="onClick">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>

<json>
{
  "component": true,
  "usingComponents": {}
}
</json>
