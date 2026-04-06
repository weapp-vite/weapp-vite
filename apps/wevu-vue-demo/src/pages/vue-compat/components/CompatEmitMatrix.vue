<script setup lang="ts">
interface NativeEventPayload {
  type?: string
  timeStamp?: number
  detail?: Record<string, any>
}

interface PayloadEvent {
  detail?: {
    marker?: string
  }
  kind: string
  meta: {
    source: string
  }
  title: string
}

const props = withDefaults(defineProps<{
  prefix?: string
  title?: string
}>(), {
  prefix: 'emit-matrix',
  title: 'emit / $event 行为矩阵',
})

const emit = defineEmits<{
  payload: [PayloadEvent]
  native: [NativeEventPayload]
  tuple: [string, number, { ok: boolean }]
  empty: []
  options: [PayloadEvent]
}>()

function emitPayload() {
  emit('payload', {
    kind: 'payload',
    meta: {
      source: 'CompatEmitMatrix',
    },
    title: 'matrix-payload',
    detail: {
      marker: 'payload-detail',
    },
  })
}

function emitNative(event: NativeEventPayload) {
  emit('native', event)
}

function emitTuple() {
  emit('tuple', 'alpha', 2, { ok: true })
}

function emitEmpty() {
  emit('empty')
}

function emitWithOptions() {
  emit(
    'options',
    {
      kind: 'options',
      meta: {
        source: 'CompatEmitMatrix',
      },
      title: 'matrix-options',
      detail: {
        marker: 'options-detail',
      },
    },
    {
      bubbles: true,
      composed: true,
    },
  )
}
</script>

<template>
  <view class="emit-matrix">
    <text class="emit-matrix-title">
      {{ props.title }}
    </text>

    <button :id="`${props.prefix}-payload`" class="emit-matrix-btn" @tap="emitPayload">
      emit payload
    </button>
    <button :id="`${props.prefix}-native`" class="emit-matrix-btn" @tap="emitNative($event)">
      emit native $event
    </button>
    <button :id="`${props.prefix}-tuple`" class="emit-matrix-btn" @tap="emitTuple">
      emit tuple args
    </button>
    <button :id="`${props.prefix}-empty`" class="emit-matrix-btn" @tap="emitEmpty">
      emit empty
    </button>
    <button :id="`${props.prefix}-options`" class="emit-matrix-btn" @tap="emitWithOptions">
      emit payload + options
    </button>
  </view>
</template>

<style>
.emit-matrix {
  padding: 16rpx;
  margin-top: 14rpx;
  background: #eef8ff;
  border-radius: 14rpx;
}

.emit-matrix-title {
  display: block;
  margin-bottom: 10rpx;
  font-size: 24rpx;
  font-weight: 600;
  color: #0f3d6e;
}

.emit-matrix-btn {
  margin-top: 10rpx;
  font-size: 23rpx;
  line-height: 62rpx;
  color: #fff;
  background: #2563eb;
  border-radius: 12rpx;
}
</style>
