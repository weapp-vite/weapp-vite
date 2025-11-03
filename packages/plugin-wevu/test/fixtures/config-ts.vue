<script lang="ts">
export default {
  type: 'page',
}
</script>

<template>
  <view>TS Config Demo</view>
</template>

<config lang="ts">
import type { Page } from '@weapp-core/schematics'

const pageConfig = {
  navigationBarTitleText: 'TS Config Demo',
  enablePullDownRefresh: true,
  usingComponents: {
    counter: '../components/counter',
  },
} satisfies Page

export default pageConfig
</config>
