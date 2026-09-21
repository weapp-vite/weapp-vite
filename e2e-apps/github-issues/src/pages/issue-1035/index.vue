<script setup lang="ts">
import { onLoad, onMounted, ref } from 'wevu'
import { useRouter } from 'wevu/router'
import { readIssue1035, recordIssue1035 } from '../../shared/issue1035'

recordIssue1035('home:setup')
const router = useRouter()
const sameRouter = readIssue1035(router).sameRouter
const lifecycleTrace = ref('')

onLoad(() => recordIssue1035('home:onLoad'))
onMounted(() => {
  recordIssue1035('home:mounted')
  lifecycleTrace.value = readIssue1035(router).trace.join(' > ')
})

function readSnapshot() {
  return readIssue1035(router)
}

async function openNext() {
  await router.push({ name: 'issue1035-next', query: { from: 'home' } })
  recordIssue1035('home:navigate:done')
}

defineExpose({ readSnapshot, openNext })
</script>

<template>
  <view id="issue-1035-home">
    <view>issue #1035 router cold start</view>
    <view id="issue-1035-identity">same router: {{ sameRouter }}</view>
    <view id="issue-1035-trace">{{ lifecycleTrace }}</view>
    <button id="issue-1035-next" @tap="openNext">Navigate to next page</button>
  </view>
</template>
