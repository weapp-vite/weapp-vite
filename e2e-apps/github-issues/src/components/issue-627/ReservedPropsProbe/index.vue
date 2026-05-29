<script setup lang="ts">
const props = defineProps<{
  id?: string
  class?: string
  style?: string
  hidden?: boolean
  dataFoo?: string
  markFoo?: string
  slot?: string
  customClass?: string
  customStyle?: string
  customHidden?: boolean
  customDataFoo?: string
}>()

function _runE2E() {
  return {
    id: props.id ?? '',
    class: props.class ?? '',
    style: props.style ?? '',
    hidden: props.hidden ?? null,
    dataFoo: props.dataFoo ?? '',
    markFoo: props.markFoo ?? '',
    slot: props.slot ?? '',
    customClass: props.customClass ?? '',
    customStyle: props.customStyle ?? '',
    customHidden: props.customHidden ?? null,
    customDataFoo: props.customDataFoo ?? '',
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view
    class="issue627-probe"
    :data-issue627-id="props.id"
    :data-issue627-class="props.class"
    :data-issue627-style="props.style"
    :data-issue627-hidden="props.hidden"
    :data-issue627-data-foo="props.dataFoo"
    :data-issue627-mark-foo="props.markFoo"
    :data-issue627-slot="props.slot"
    :data-issue627-custom-class="props.customClass"
    :data-issue627-custom-style="props.customStyle"
    :data-issue627-custom-hidden="props.customHidden"
    :data-issue627-custom-data-foo="props.customDataFoo"
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
