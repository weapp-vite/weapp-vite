<script setup lang="ts">
import { onMounted } from 'wevu'
import { useRoute, useRouter } from 'wevu/router'
import { readIssue1035, recordIssue1035 } from '../../shared/issue1035'

recordIssue1035('next:setup')
const router = useRouter()
const route = useRoute()
const sameRouter = readIssue1035(router).sameRouter
onMounted(() => recordIssue1035('next:mounted'))

function readSnapshot() {
  return { ...readIssue1035(router), from: route.query.from }
}

async function goBack() {
  await router.back()
  recordIssue1035('next:back:done')
}

defineExpose({ readSnapshot, goBack })
</script>

<template>
  <view id="issue-1035-next-page">
    <view>issue #1035 navigation result</view>
    <view id="issue-1035-next-identity">same router: {{ sameRouter }}</view>
    <view id="issue-1035-query">from: {{ route.query.from }}</view>
    <button id="issue-1035-back" @tap="goBack">Back</button>
  </view>
</template>
