<script setup lang="ts">
import { readFeature1087Probe, releaseFeature1087Restore } from '../../../shared/feature1087'

definePageJson({ navigationBarTitleText: '1087 second tab', renderer: 'webview' })
const _snapshot = readFeature1087Probe
const _release = releaseFeature1087Restore
defineExpose({ _snapshot, _release })
</script>

<template>
  <view id="feature1087-tab-peer">Switch back without replaying the retained tab snapshot</view>
</template>
