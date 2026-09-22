<script setup lang="ts">
import { computed, ref } from 'wevu'

const props = defineProps<{ count: number }>()
const emit = defineEmits<{ change: [value: number] }>()
const localClicks = ref(0)
const doubled = computed(() => props.count * 2)

function increase() {
  localClicks.value += 1
  emit('change', props.count + 1)
}
</script>

<template>
  <view>
    <text>子组件：{{ count }} / doubled={{ doubled }} / clicks={{ localClicks }}</text>
    <button @tap="increase">子组件 +1</button>
  </view>
</template>
