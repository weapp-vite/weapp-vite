<script setup lang="ts">
import { ref } from 'wevu'

const count = ref(0)
</script>

<template>
  <view id="tag-page">
    <text id="builtin">builtin</text>
    <CaseCard id="pascal" :label="`pascal-${count}`" />
    <case-card id="kebab" :label="`kebab-${count}`" />
    <CaseCard id="duplicate" :label="`duplicate-${count}`" />
    <button id="increment" @tap="count++">
      {{ count }}
    </button>
  </view>
</template>
