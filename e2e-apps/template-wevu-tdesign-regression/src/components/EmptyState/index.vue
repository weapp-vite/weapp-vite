<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    actionText?: string
  }>(),
  {
    description: '',
    actionText: '',
  },
)

const emit = defineEmits<{
  (e: 'action'): void
}>()

defineComponentJson({
  styleIsolation: 'apply-shared',
})

function onAction() {
  emit('action')
}
</script>

<template>
  <view class="rounded-[20rpx] bg-white p-[24rpx] shadow-[0_12rpx_28rpx_rgba(17,24,39,0.08)]">
    <t-empty :title="title" :description="description" />
    <view v-if="props.actionText" class="mt-[16rpx]">
      <t-button block theme="primary" variant="outline" @tap="onAction">
        {{ props.actionText }}
      </t-button>
    </view>
  </view>
</template>
