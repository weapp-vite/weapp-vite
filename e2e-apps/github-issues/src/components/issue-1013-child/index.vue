<script setup lang="ts">
import { watch } from 'wevu'

const props = defineProps<{ trigger: number }>()
const emit = defineEmits<{
  ready: [status: string]
}>()

watch(() => props.trigger, () => {
  emit('ready', 'ready')
})
</script>

<template>
  <view id="issue-1013-child">component child</view>
</template>
