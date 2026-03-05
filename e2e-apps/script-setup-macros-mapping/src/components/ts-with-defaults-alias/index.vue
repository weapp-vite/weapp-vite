<script setup lang="ts">
interface AliasProps {
  label?: string
  list?: number[]
  options?: { source: string }
  enabled?: boolean
}

const props = withDefaults(defineProps<AliasProps>(), {
  label: 'alias-default-label',
  list: () => [1, 2, 3],
  options: () => ({ source: 'alias-defaults' }),
  enabled: true,
})

const emit = defineEmits<{
  (e: 'pick', value: number): void
  (e: 'close'): void
}>()

function emitPick() {
  emit('pick', props.list?.[0] ?? 0)
}

function emitClose() {
  emit('close')
}

defineExpose({
  emitPick,
  emitClose,
})
</script>

<template>
  <view class="panel">
    <text id="ts-alias-label">
      {{ props.label }}|{{ props.options?.source }}|{{ props.enabled ? '1' : '0' }}
    </text>
    <button id="ts-alias-pick" @tap="emitPick">
      pick
    </button>
    <button id="ts-alias-close" @tap="emitClose">
      close
    </button>
  </view>
</template>
