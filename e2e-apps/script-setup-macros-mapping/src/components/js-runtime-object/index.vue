<script setup>
const props = defineProps({
  message: {
    type: String,
    default: 'js-default-message',
  },
  level: {
    type: Number,
    required: true,
  },
})

const emit = defineEmits({
  change: value => typeof value === 'number',
  close: null,
})

function emitChange() {
  emit('change', props.level + 1)
}

function emitClose() {
  emit('close')
}

defineExpose({
  emitChange,
  emitClose,
})
</script>

<template>
  <view class="panel">
    <text id="js-object-label">
      {{ props.message }}|{{ props.level }}
    </text>
    <button id="js-object-change" @tap="emitChange">
      change
    </button>
    <button id="js-object-close" @tap="emitClose">
      close
    </button>
  </view>
</template>
