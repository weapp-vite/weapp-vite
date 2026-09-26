<script setup lang="ts">
import { nextTick, onHide, onUnload, ref, storeToRefs } from 'wevu'
import Subscriber from '../../components/issue1049Subscriber.vue'
import { metrics, snapshot, useIssue1049Store } from '../../shared/issue1049Store'

const store = useIssue1049Store()
const { count, doubled } = storeToRefs(store)
const visible = ref(true)
store.$subscribe(() => metrics.page++, { flush: 'sync' })
store.$subscribe(() => metrics.detached++, { detached: true, flush: 'sync' })
store.$onAction(({ name, after, onError }) => {
  metrics.actions++
  if (name === 'wait') {
    after(() => metrics.after++)
  }
  if (name === 'reject') {
    onError(() => metrics.errors++)
  }
})
store.$onAction(() => metrics.detachedActions++, true)
onHide(() => metrics.hidden++)
onUnload(() => metrics.unloaded++)

function _startActions() {
  void store.wait()
  void store.reject().catch(() => {})
  return snapshot()
}
function _mutate() {
  store.increment()
  return snapshot()
}
async function _removeChild() {
  visible.value = false
  await nextTick()
}
const _snapshot = snapshot
</script>

<template>
  <view id="issue1049-page">
    <text id="issue1049-count">{{ count }}</text>
    <text id="issue1049-double">{{ doubled }}</text>
    <Subscriber v-if="visible" id="issue1049-subscriber" />
  </view>
</template>
