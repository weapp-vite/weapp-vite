<script lang="ts">
import InternalLeaf from '../leaf/index.vue'

export default { components: { RegisteredLeaf: InternalLeaf } }
</script>

<script setup lang="ts">
import type { SlotContext } from '../../context'
import { provide, shallowRef } from 'wevu'
import { SLOT_CONTEXT } from '../../context'
import Leaf from '../leaf/index.vue'

defineOptions({ behaviors: ['wx://component-export'] })
const count = shallowRef(200)
function increment() {
  count.value++
}
const context: SlotContext = {
  label: 'exported-inner',
  count,
  increment,
  isSame: (injected, injectedCount, injectedIncrement) => injected === context
    && injectedCount === count
    && injectedIncrement === increment,
}
provide(SLOT_CONTEXT, context)
defineExpose({ label: 'public-provider', increment })
defineComponentJson({ component: true, usingComponents: { 'native-owner': '../nativeOwner/index' } })
</script>

<template>
  <view id="provider-exported-inner">provider:{{ count }}</view>
  <Leaf probe="exported-internal" />
  <registered-leaf probe="exported-aliased" />
  <native-owner />
  <slot />
</template>
