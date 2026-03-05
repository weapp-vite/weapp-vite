<script setup>
const props = defineProps(['foo', 'bar'])

const emit = defineEmits(['submit', 'cancel'])

function emitSubmit() {
  emit('submit', {
    foo: props.foo,
    bar: props.bar,
  })
}

function emitCancel() {
  emit('cancel')
}

defineExpose({
  emitSubmit,
  emitCancel,
})
</script>

<template>
  <view class="panel">
    <text id="js-array-label">
      {{ props.foo }}|{{ props.bar }}
    </text>
    <button id="js-array-submit" @tap="emitSubmit">
      submit
    </button>
    <button id="js-array-cancel" @tap="emitCancel">
      cancel
    </button>
  </view>
</template>
