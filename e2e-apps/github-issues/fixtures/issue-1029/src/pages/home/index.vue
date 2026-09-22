<script setup lang="ts">
import { computed, onMounted } from 'wevu'
import { useRoute } from 'wevu/router'
import { navigate, snapshot, trace } from '../../router'

definePageMeta({
  layout: false,
})
definePage({
  name: 'home',
  meta: { title: '首页', requiresAuth: false, tags: ['public'] },
})
definePageJson({ navigationBarTitleText: '宿主标题' })

const route = useRoute()
const title = computed(() => route.meta?.title ?? '')
const redirected = computed(() => route.query.redirected ?? '')
onMounted(() => trace.push({ phase: 'mounted', to: route.name }))
function _runE2E(command = 'snapshot') {
  return command === 'snapshot' ? snapshot() : navigate(command)
}
defineExpose({ _runE2E })
</script>

<template>
  <view id="issue-1029-home">
    <view id="route-title">{{ title }}</view>
    <view id="route-redirect">{{ redirected }}</view>
    <button id="open-profile" @tap="navigate('profile')">Profile</button>
    <button id="abort-profile" @tap="navigate('abort')">Abort</button>
    <button id="redirect-profile" @tap="navigate('redirect')">Redirect</button>
    <button id="open-legacy" @tap="navigate('legacy')">Legacy</button>
  </view>
</template>
