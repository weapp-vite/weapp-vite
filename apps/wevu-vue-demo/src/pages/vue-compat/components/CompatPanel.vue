<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'wevu'

interface RunPayload {
  at: string
  title: string
}

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    tone?: 'neutral' | 'success'
  }>(),
  {
    description: '',
    tone: 'neutral',
  },
)

const emit = defineEmits<{
  run: [RunPayload]
}>()

const attrs = useAttrs()
const slots = useSlots()
const toneClass = computed(() => (props.tone === 'success' ? 'success' : ''))
const hasFoot = computed(() => Boolean(slots.foot))

function run() {
  emit('run', {
    at: new Date().toISOString(),
    title: props.title,
  })
}

defineExpose({ run })
</script>

<template>
  <view class="panel" :class="[toneClass]">
    <slot name="head">
      <text class="panel-title">
        {{ props.title }}
      </text>
    </slot>

    <text v-if="props.description" class="panel-desc">
      {{ props.description }}
    </text>

    <slot>
      <text class="panel-desc">
        默认插槽内容
      </text>
    </slot>

    <text class="panel-meta">
      attrs keys: {{ Object.keys(attrs).join(', ') || '(none)' }}
    </text>
    <text class="panel-meta">
      has foot slot: {{ hasFoot ? 'yes' : 'no' }}
    </text>

    <button class="run-btn" @tap="run">
      emit run
    </button>

    <slot name="foot" />
  </view>
</template>

<style>
.panel {
  padding: 16rpx;
  margin-bottom: 14rpx;
  background: #f4f7ff;
  border-radius: 14rpx;
}

.panel.success {
  background: #e6f7ec;
}

.panel-title {
  display: block;
  font-size: 27rpx;
  font-weight: 600;
}

.panel-desc,
.panel-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 23rpx;
  color: #526180;
}

.run-btn {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 66rpx;
  color: #fff;
  background: #395af0;
  border-radius: 12rpx;
}
</style>
