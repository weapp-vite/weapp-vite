<script setup lang="ts">
import type { DashboardObjectMeasurements } from 'weapp-vite/dashboard'
import { computed } from 'vue'
import { formatBytes } from '../../utils/format'

const props = defineProps<{ measurements: DashboardObjectMeasurements }>()
const rows = computed(() => [
  { label: '原始产物', bytes: props.measurements.rawBytes },
  { label: 'gzip', bytes: props.measurements.gzipBytes },
  { label: 'brotli', bytes: props.measurements.brotliBytes },
  { label: '模块归因', bytes: props.measurements.attributedBytes },
  { label: '源码', bytes: props.measurements.sourceBytes },
])
</script>

<template>
  <dl class="flex flex-wrap gap-x-6 gap-y-3 text-sm">
    <div v-for="row in rows" :key="row.label">
      <dt class="text-xs text-(--dashboard-text-soft)">{{ row.label }}</dt>
      <dd class="mt-1 font-mono text-(--dashboard-text)">{{ row.bytes === null ? '未测量' : formatBytes(row.bytes) }}</dd>
    </div>
  </dl>
</template>
