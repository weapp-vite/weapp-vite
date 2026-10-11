<script setup lang="ts">
import type { SlotContext } from '../../context'
import { provide, shallowRef } from 'wevu'
import { SLOT_CONTEXT } from '../../context'
import Leaf from '../leaf/index.vue'

defineOptions({ options: { multipleSlots: true } })
const props = defineProps<{ label: string, seed: number, internal?: boolean }>()
const count = shallowRef(props.seed)

function increment() {
  count.value++
}

const context: SlotContext = {
  label: props.label,
  count,
  increment,
  isSame: (injected, injectedCount, injectedIncrement) => injected === context
    && injectedCount === count
    && injectedIncrement === increment,
}
provide(SLOT_CONTEXT, context)

defineComponentJson({ component: true })
</script>

<template>
  <view :id="`provider-${label}`">provider:{{ count }}</view>
  <Leaf v-if="internal" :probe="`${label}-internal`" />
  <slot />
  <slot name="named" />
</template>
