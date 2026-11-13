<script setup lang="ts">
import { ref } from "wevu";

const weight = ref(123);
</script>

<template>
  <view><text id="actual">总重：<text>{{ weight }}</text>kg</text></view>
  <view><text id="reference">总重：123kg</text></view>
</template>
