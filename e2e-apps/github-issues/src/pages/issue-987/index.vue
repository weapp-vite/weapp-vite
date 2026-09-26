<script setup lang="ts">
const following = {
  data: {
    value: null as string[] | null,
  },
}

const drafts = {
  data: {
    value: ['a'] as string[] | null,
  },
}

const items = ['x']
</script>

<template>
  <view
    id="issue-987"
    :data-empty="(following.data.value ?? []).length === 0"
  >
    <view
      v-if="(following.data.value ?? []).length === 0"
      id="issue-987-empty"
    >
      empty
    </view>
    <text id="issue-987-drafts">草稿({{ (drafts.data.value ?? []).length }})</text>
    <text id="issue-987-or">or({{ (following.data.value || []).length }})</text>
    <text id="issue-987-ternary">ternary({{ (true ? items : []).length }})</text>
    <text id="issue-987-paren">paren({{ (items).length }})</text>
    <text id="issue-987-binary">binary({{ (items.concat(items)).length }})</text>
  </view>
</template>
