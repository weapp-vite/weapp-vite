<script setup>
const a = {
  b: {},
}
</script>

<template>
  <view id="issue-805-nullish">{{ a?.b?.d ?? 4 }}</view>
  <view id="issue-805-logical">{{ a?.b?.d || 4 }}</view>
</template>
