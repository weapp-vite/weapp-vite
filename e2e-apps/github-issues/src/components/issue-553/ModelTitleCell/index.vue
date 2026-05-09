<script setup lang="ts">
const props = defineProps<{
  title: string
}>()

const emit = defineEmits<{
  (e: 'update:title', value: string): void
}>()

defineComponentJson({
  component: true,
})

function updateTitle() {
  emit('update:title', 'issue-553 updated title')
}
</script>

<template>
  <view class="issue553-model-title-cell">
    <text
      class="issue553-model-title-cell__title"
      :data-issue553-child-title="props.title"
    >
      {{ props.title }}
    </text>
    <view
      class="issue553-model-title-cell__action"
      data-issue553-update="true"
      @tap="updateTitle"
    >
      update issue-553 title
    </view>
  </view>
</template>

<style scoped>
.issue553-model-title-cell {
  padding: 24rpx;
  background: #fff;
  border-radius: 12rpx;
}

.issue553-model-title-cell__title {
  display: block;
  color: #0f172a;
}

.issue553-model-title-cell__action {
  padding: 18rpx;
  margin-top: 18rpx;
  color: #0f172a;
  background: #bae6fd;
  border-radius: 10rpx;
}
</style>
