<script setup lang="ts">
const props = defineProps<{
  class?: string
  style?: string
  customClass?: string
  customStyle?: string
}>()

function _runE2E() {
  return {
    class: props.class ?? '',
    style: props.style ?? '',
    customClass: props.customClass ?? '',
    customStyle: props.customStyle ?? '',
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    class="issue627-probe"
    :data-issue627-class="props.class"
    :data-issue627-style="props.style"
    :data-issue627-custom-class="props.customClass"
    :data-issue627-custom-style="props.customStyle"
  >
    issue-627 reserved props probe
  </view>
</template>

<style scoped>
.issue627-probe {
  min-height: 48rpx;
  line-height: 48rpx;
}
</style>
