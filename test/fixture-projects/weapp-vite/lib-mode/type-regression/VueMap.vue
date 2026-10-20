<script setup lang="ts">
import { useTemplateRef } from 'vue'

const mapRef = useTemplateRef('mapRef')
defineExpose({ mapRef })
</script>

<template>
  <map ref="mapRef" name="browser-map" />
</template>
