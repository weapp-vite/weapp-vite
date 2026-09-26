<script setup lang="ts">
import { getActivePinia, ref, storeToRefs } from 'wevu'
import { runStoreBoundaries } from '../../../shared/issue1049Boundaries'
import { resetScenario, settleActions, snapshot, useIssue1049Store } from '../../../shared/issue1049Store'

const store = useIssue1049Store()
const { count, doubled } = storeToRefs(store)
const boundarySummary = ref('pending')
let boundaryResult: Awaited<ReturnType<typeof runStoreBoundaries>> | { error: string } | null = null
function _boundaries() {
  void runStoreBoundaries().then((result) => {
    boundaryResult = result
    boundarySummary.value = result.summary
  }).catch((error: unknown) => {
    boundaryResult = { error: String(error) }
    boundarySummary.value = 'failed'
  })
}
function _boundarySnapshot() {
  return boundaryResult
}
function _mutate() {
  store.increment()
  return snapshot()
}
function _finish() {
  void settleActions()
}
function _dispose() {
  const previous = useIssue1049Store()
  previous.$dispose()
  const recreated = useIssue1049Store()
  previous.$dispose()
  const result = { different: previous !== recreated, retained: recreated.count, same: recreated === useIssue1049Store() }
  recreated.$dispose()
  delete getActivePinia()!.state.value['issue-1049']
  return { ...result, fresh: useIssue1049Store().count }
}
const _snapshot = snapshot
const _resetScenario = resetScenario
</script>

<template>
  <view id="issue1049-result" class="result-page">
    <text id="issue1049-count">{{ count }}</text>
    <text id="issue1049-double">{{ doubled }}</text>
    <text id="issue1049-boundaries">{{ boundarySummary }}</text>
  </view>
</template>
