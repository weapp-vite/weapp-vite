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
</script>

<template>
  <view class="query">
    <slot :data="data" :label="props.label" />
  </view>
</template>
