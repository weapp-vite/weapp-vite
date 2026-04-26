<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'wevu'

definePageJson({
  navigationBarTitleText: 'issue-446',
})

interface ShortBindProbeExposed {
  snapshot: () => {
    visible: boolean
    fooBar: string
    summary: string
  }
}

const nativeAnchorRef = useTemplateRef<Record<string, any>>('nativeAnchor')
const shortBindProbeRef = useTemplateRef<ShortBindProbeExposed>('shortBindProbe')
const mounted = ref(false)
const visible = ref(true)
const fooBar = ref('issue-446-short-bind')

const nativeAnchorReady = computed(() => nativeAnchorRef.value != null)
const componentReady = computed(() => typeof shortBindProbeRef.value?.snapshot === 'function')

onMounted(() => {
  mounted.value = true
})

function _runE2E() {
  const snapshot = shortBindProbeRef.value?.snapshot?.() ?? null

  return {
    ok: mounted.value
      && nativeAnchorReady.value
      && componentReady.value
      && snapshot?.visible === visible.value
      && snapshot?.fooBar === fooBar.value,
    mounted: mounted.value,
    nativeAnchorReady: nativeAnchorReady.value,
    componentReady: componentReady.value,
    shortBindVisible: visible.value,
    shortBindFooBar: fooBar.value,
    componentSnapshot: snapshot,
  }
}
</script>

<template>
  <view class="issue446-page">
    <text class="issue446-title">
      issue-446 template ref and shortBind
    </text>
    <view id="issue446-anchor" ref="nativeAnchor" class="issue446-anchor">
      native anchor
    </view>
    <ShortBindProbe
      ref="shortBindProbe"
      :visible
      :foo-bar
    />
  </view>
</template>

<style scoped>
.issue446-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 32rpx;
  background: #f8fafc;
}

.issue446-title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.issue446-anchor {
  padding: 20rpx;
  color: #1e293b;
  background: #bae6fd;
  border-radius: 16rpx;
}
</style>
