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
    <text>web runtime custom component</text>
    <Pressable>
      <text>ready</text>
    </Pressable>
  </view>
</template>
