<script setup lang="ts">
import Pressable from '@/components/issue-804/Pressable/index.vue'

definePageJson({
  navigationBarTitleText: 'issue-804',
})

definePageMeta({
  layout: false,
})
</script>

<template>
  <view id="issue804-page" class="issue804-page">
    <text id="issue804-title">web runtime custom component</text>
    <Pressable id="issue804-pressable">
      <text id="issue804-ready">ready</text>
    </Pressable>
  </view>
</template>
