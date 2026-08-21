<script setup lang="ts">
import { onAttached, ref } from 'wevu'

const props = defineProps<{
  label?: string
  queryFn?: () => Promise<string[]>
}>()

const data = ref<string[]>()

onAttached(async () => {
  data.value = await props.queryFn?.()
})

function _runE2E() {
  return {
    hasQueryFn: typeof props.queryFn === 'function',
    result: data.value,
  }
}

defineExpose({
  _runE2E,
})
</script>

<template>
  <view class="query">
    <slot :data="data" :label="props.label" />
  </view>
</template>
