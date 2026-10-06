<script lang="ts">
// eslint-disable-next-line import/no-duplicates -- 保留普通 script 注册别名与 script setup 直接导入的两条编译路径。
import InternalLeaf from '../leaf/index.vue'

export default { components: { RegisteredLeaf: InternalLeaf } }
</script>

<script setup lang="ts">
/* eslint-disable import/first -- 双 script 回归需保留普通 script 的默认导出，不能移入 script setup。 */
import type { SlotContext } from '../../context'
import { provide, shallowRef } from 'wevu'
import { SLOT_CONTEXT } from '../../context'
// eslint-disable-next-line import/no-duplicates -- 保留 script setup 直接导入，与普通 script 注册别名对照。
import Leaf from '../leaf/index.vue'
/* eslint-enable import/first */

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
  <!-- eslint-disable-next-line vue/component-name-in-template-casing -- 验证普通 script 注册的别名能够通过短横线标签解析。 -->
  <registered-leaf probe="exported-aliased" />
  <native-owner />
  <slot />
</template>
