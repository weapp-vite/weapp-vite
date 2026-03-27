<script setup lang="ts">
import type { PackageInsight } from '../composables/useAnalyzeDashboardData'
import { formatBuildOrigin, formatBytes } from '../utils/format'

defineProps<{
  files: PackageInsight['topFiles']
}>()
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-[color:var(--dashboard-border)]">
    <table class="min-w-full divide-y divide-[color:var(--dashboard-border)] text-left text-sm">
      <thead class="bg-[color:var(--dashboard-panel-muted)] text-[color:var(--dashboard-text-soft)]">
        <tr>
          <th class="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em]">
            文件
          </th>
          <th class="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em]">
            类型
          </th>
          <th class="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em]">
            来源
          </th>
          <th class="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.18em]">
            体积
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-[color:var(--dashboard-border)] text-[color:var(--dashboard-text-muted)]">
        <tr v-for="file in files" :key="file.file">
          <td class="px-3 py-2 font-mono text-xs text-[color:var(--dashboard-text)]">
            {{ file.file }}
          </td>
          <td class="px-3 py-2">
            {{ file.type }}
          </td>
          <td class="px-3 py-2">
            {{ formatBuildOrigin(file.from) }}
          </td>
          <td class="px-3 py-2 font-medium text-[color:var(--dashboard-text)]">
            {{ formatBytes(file.size) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
