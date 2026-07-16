<script setup lang="ts">
definePageJson({
  navigationBarTitleText: 'issue-724',
})

const issue724ScriptMarker = 'issue-724-script-marker'
</script>

<template>
  <view class="issue-724-page issue-724-style-src">
    <text class="issue-724-template-marker">
      issue-724-template-marker
    </text>
    <text class="issue-724-script-marker">
      {{ issue724ScriptMarker }}
    </text>
    <Issue724RoutingProbe />
  </view>
</template>

<style>
.issue-724-page {
  display: block;
}
</style>

<style lang="scss">
.issue-724-template-marker {
  font-weight: 600;
}

.issue-724-template-marker + .issue-724-script-marker {
  display: block;
}
</style>

<style lang="scss" src="./external.scss"></style>
