<script setup lang="ts">
import type { A2uiSurfaceView } from '@wevu/a2ui'
import { createA2uiSession } from '@wevu/a2ui'
import { onUnload, shallowRef } from 'wevu'
import { demoCatalog } from '../../catalog'
import { basicMessages } from '../../fixtures/afterSales'

definePageJson({
  usingComponents: {
    'a2ui-node': '/components/a2ui-node/index',
  },
})
const views = shallowRef<A2uiSurfaceView[]>([])
const session = createA2uiSession({
  catalog: demoCatalog,
  onSurfaces: (next) => {
    views.value = next
  },
  onAction: () => {},
})
for (const message of basicMessages) {
  session.receive(message)
}
onUnload(() => session.dispose())
</script>

<template>
  <view class="page">
    <a2ui-node v-for="view in views" :key="view.id" :node="view.root" />
  </view>
</template>
