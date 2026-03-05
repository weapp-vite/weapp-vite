<script setup lang="ts">
const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  active: {
    type: Boolean,
    default: false,
  },
  size: {
    type: Number,
    default: 20,
  },
})

const emit = defineEmits({
  toggle: (value: boolean) => typeof value === 'boolean',
  resize: (value: number) => typeof value === 'number',
})

function emitToggle() {
  emit('toggle', !props.active)
}

function emitResize() {
  emit('resize', props.size + 1)
}

defineExpose({
  emitToggle,
  emitResize,
})
</script>

<template>
  <view class="panel">
    <text id="ts-runtime-label">
      {{ props.label }}|{{ props.active ? '1' : '0' }}|{{ props.size }}
    </text>
    <button id="ts-runtime-toggle" @tap="emitToggle">
      toggle
    </button>
    <button id="ts-runtime-resize" @tap="emitResize">
      resize
    </button>
  </view>
</template>
