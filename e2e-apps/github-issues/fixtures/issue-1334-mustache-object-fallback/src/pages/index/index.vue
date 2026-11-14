<script setup lang="ts">
import { ref } from "wevu";
import ResultPreview from "../../components/ResultPreview.vue";

const preview = ref<{ rawValueText: string; valueText: string } | null>(null);
</script>

<template>
  <ResultPreview :preview="preview || { rawValueText: '—', valueText: '—' }" />
</template>
