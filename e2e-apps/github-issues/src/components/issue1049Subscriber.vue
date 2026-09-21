<script setup lang="ts">
import { metrics, useIssue1049Store } from '../shared/issue1049Store'

const store = useIssue1049Store()
store.$subscribe(() => metrics.child++, { flush: 'sync' })
</script>

<template>
  <view id="issue1049-child">child subscribed</view>
</template>
