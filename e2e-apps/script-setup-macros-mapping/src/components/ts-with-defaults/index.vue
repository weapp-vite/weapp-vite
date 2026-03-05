<script setup lang="ts">
interface TsWithDefaultsProps {
  title?: string
  count?: number
  tags?: string[]
  meta?: Record<string, string>
  tone?: 'neutral' | 'success'
}

const props = withDefaults(defineProps<TsWithDefaultsProps>(), {
  title: 'ts-default-title',
  count: 3,
  tags: () => ['a', 'b'],
  meta: () => ({ source: 'ts-defaults' }),
  tone: 'neutral',
})

const emit = defineEmits<{
  save: [payload: { title: string, count: number }]
  reset: []
}>()

function emitSave() {
  emit('save', {
    title: props.title ?? '',
    count: props.count ?? 0,
  })
}

function emitReset() {
  emit('reset')
}

defineExpose({
  emitSave,
  emitReset,
})
</script>

<template>
  <view class="panel">
    <text id="ts-defaults-title">
      {{ props.title }}|{{ props.count }}|{{ props.tags?.join('-') }}
    </text>
    <button id="ts-defaults-save" @tap="emitSave">
      save
    </button>
    <button id="ts-defaults-reset" @tap="emitReset">
      reset
    </button>
  </view>
</template>
