<script setup lang="ts">
import { computed } from 'wevu'

const props = withDefaults(
  defineProps<{
    content?: number | string
    src?: string
    nullable: string | null
  }>(),
  {
    src: '',
  },
)

function describeValue(value: unknown) {
  if (value === undefined) {
    return 'undefined'
  }
  if (value === null) {
    return 'null'
  }
  return `${typeof value}:${String(value)}`
}

const currentSummary = computed(() => `${describeValue(props.content)}|${describeValue(props.src)}`)

const initialSummary = currentSummary.value

function snapshot() {
  return {
    content: describeValue(props.content),
    src: describeValue(props.src),
    nullable: describeValue(props.nullable),
    initialSummary,
  }
}

defineExpose({
  snapshot,
})
</script>

<template>
  <view class="issue955-probe" :data-summary="currentSummary">
    <text class="issue955-probe__content">
      {{ props.content }}
    </text>
    <text class="issue955-probe__src">
      {{ props.src }}
    </text>
    <text class="issue955-probe__nullable">
      {{ props.nullable }}
    </text>
  </view>
</template>

<style scoped>
.issue955-probe {
  padding: 20rpx;
  background: #fff;
  border-radius: 12rpx;
}

.issue955-probe__content,
.issue955-probe__src {
  display: block;
  color: #0f172a;
}
</style>
