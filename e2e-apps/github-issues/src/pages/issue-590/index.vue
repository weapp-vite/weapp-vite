<script setup lang="ts">
import SimpleBadge from '../../components/issue-590/SimpleBadge/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-590',
})
</script>

<template>
  <view class="issue590-page">
    <text>issue-590 no setup props computed style</text>
    <SimpleBadge
      color="#1677ff"
      active
      label="issue-590 badge"
    />
  </view>
</template>

<style>
.issue590-page {
  padding: 16px;
}
</style>
