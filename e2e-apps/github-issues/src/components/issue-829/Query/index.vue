<script setup lang="ts">
import { onReady, ref } from 'wevu'

const props = defineProps<{
  label?: string
  queryFn?: () => Promise<string[]>
}>()

const data = ref<string[]>()

onReady(async () => {
  data.value = await props.queryFn?.()
})
</script>

<template>
  <view class="query">
    <slot :data="data" :label="props.label" />
  </view>
</template>
