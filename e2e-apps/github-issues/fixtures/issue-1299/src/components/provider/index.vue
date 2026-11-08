<script setup lang="ts">
import type { SlotContext } from '../../context'
import { provide, shallowRef } from 'wevu'
import { SLOT_CONTEXT } from '../../context'

const props = defineProps<{ label: string, seed: number }>()
const count = shallowRef(props.seed)

function increment() {
  count.value++
}

const context: SlotContext = {
  label: props.label,
  count,
  increment,
  isSame: (injected, injectedCount, injectedAction) => injected === context
    && injectedCount === count
    && injectedAction === increment,
}
provide(SLOT_CONTEXT, context)
</script>

<template>
  <view :id="`provider-${label}`">provider:{{ count }}</view>
  <slot />
</template>
