<script setup lang="ts">
import { onMounted, onUnmounted, ref, toRefs, useNativeInstance, watch } from 'wevu'

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
const nativeInstance = useNativeInstance()
const THRESHOLD = 0.3
const MIN_DISTANCE = 10

const touchState = {
  leftWidth: 0,
  rightWidth: 0,
  offset: 0,
  startOffset: 0,
  direction: '',
  deltaX: 0,
  deltaY: 0,
  offsetX: 0,
  offsetY: 0,
  startX: 0,
  startY: 0,
  dragging: false,
}

function getTouchPoint(event: any) {
  return event?.touches?.[0] || event?.changedTouches?.[0]
}

function getDirection(x: number, y: number) {
  if (x > y && x > MIN_DISTANCE) {
    return 'horizontal'
  }
  if (y > x && y > MIN_DISTANCE) {
    return 'vertical'
  }
  return ''
}

function range(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max)
}

function getWrapper() {
  return (nativeInstance as any).selectComponent?.('#wrapper')
}

function swipeMove(nextOffset = 0) {
  touchState.offset = range(nextOffset, -touchState.rightWidth, touchState.leftWidth)
  const transform = `translate3d(${touchState.offset}px, 0, 0)`
  const transition = touchState.dragging
    ? 'none'
    : 'transform .6s cubic-bezier(0.18, 0.89, 0.32, 1)'
  getWrapper()?.setStyle?.({
    '-webkit-transform': transform,
    '-webkit-transition': transition,
    transform,
    transition,
  })
}

function close() {
  closed.value = true
  swipeMove(0)
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
  swipeMove(position === 'left' ? touchState.leftWidth : -touchState.rightWidth)
}

function closeOther() {
  const instances = getSwipeoutInstances()
  instances.filter(item => item !== controller).forEach(item => item.close())
}

function noop() {
  return undefined
}

function resetTouchStatus() {
  touchState.direction = ''
  touchState.deltaX = 0
  touchState.deltaY = 0
  touchState.offsetX = 0
  touchState.offsetY = 0
}

function startDrag(event: any) {
  if (disabled.value) {
    return
  }
  resetTouchStatus()
  touchState.startOffset = touchState.offset
  const touchPoint = getTouchPoint(event)
  if (!touchPoint) {
    return
  }
  touchState.startX = touchPoint.clientX
  touchState.startY = touchPoint.clientY
  closeOther()
}

function onDrag(event: any) {
  if (disabled.value) {
    return
  }
  const touchPoint = getTouchPoint(event)
  if (!touchPoint) {
    return
  }
  touchState.deltaX = touchPoint.clientX - touchState.startX
  touchState.deltaY = touchPoint.clientY - touchState.startY
  touchState.offsetX = Math.abs(touchState.deltaX)
  touchState.offsetY = Math.abs(touchState.deltaY)
  touchState.direction = touchState.direction || getDirection(touchState.offsetX, touchState.offsetY)
  if (touchState.direction !== 'horizontal') {
    return
  }
  touchState.dragging = true
  swipeMove(touchState.startOffset + touchState.deltaX)
}

function endDrag() {
  if (disabled.value) {
    return
  }
  touchState.dragging = false
  if (
    touchState.rightWidth > 0
    && -touchState.startOffset < touchState.rightWidth
    && -touchState.offset > touchState.rightWidth * THRESHOLD
  ) {
    open('right')
  }
  else if (
    touchState.leftWidth > 0
    && touchState.startOffset < touchState.leftWidth
    && touchState.offset > touchState.leftWidth * THRESHOLD
  ) {
    open('left')
  }
  else if (touchState.startOffset !== touchState.offset) {
    close()
  }
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
  startDrag,
  onDrag,
  endDrag,
  onClick,
})

watch(leftWidth, (value = 0) => {
  touchState.leftWidth = value
  if (touchState.offset > 0) {
    swipeMove(touchState.leftWidth)
  }
}, {
  immediate: true,
})

watch(rightWidth, (value = 0) => {
  touchState.rightWidth = value
  if (touchState.offset < 0) {
    swipeMove(-touchState.rightWidth)
  }
}, {
  immediate: true,
})

onMounted(() => {
  getSwipeoutInstances().push(controller)
})

onUnmounted(() => {
  const instances = getSwipeoutInstances()
  const globalStore = globalThis as any
  globalStore.__WEVU_SWIPEOUT_INSTANCES__ = instances.filter(item => item !== controller)
})

defineComponentJson({
  component: true,
  usingComponents: {},
})
</script>

<template>
  <view
    class="wr-class wr-swipeout relative overflow-hidden"
    data-key="cell"
    capture-bind:tap="onClick"
    @touchstart="startDrag"
    @touchmove.capture="onDrag"
    @touchend="endDrag"
    @touchcancel="endDrag"
  >
    <view id="wrapper">
      <view v-if="leftWidth" class="wr-swipeout__left absolute top-0 h-full left-0 transform-[translate3d(-100%,0,0)]" data-key="left" @tap.stop="onClick">
        <slot name="left" />
      </view>
      <slot />
      <view v-if="rightWidth" class="wr-swipeout__right absolute top-0 h-full right-0 transform-[translate3d(100%,0,0)]" data-key="right" @tap.stop="onClick">
        <slot name="right" />
      </view>
    </view>
  </view>
</template>
