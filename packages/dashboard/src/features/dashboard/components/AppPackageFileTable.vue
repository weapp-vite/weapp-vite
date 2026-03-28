<script setup lang="ts">
import type { PackageInsight } from '../types'
import { computed } from 'vue'
import { formatBuildOrigin, formatBytes } from '../utils/format'

interface PackageFileRowItem {
  file: string
  type: string
  fromLabel: string
  sizeLabel: string
}

const props = defineProps<{
  files: PackageInsight['topFiles']
}>()

function createPackageFileRow(file: PackageInsight['topFiles'][number]): PackageFileRowItem {
  return {
    file: file.file,
    type: file.type,
    fromLabel: formatBuildOrigin(file.from),
    sizeLabel: formatBytes(file.size),
  }
}

const fileRows = computed(() => props.files.map(file => createPackageFileRow(file)))
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
        <tr v-for="file in fileRows" :key="file.file">
          <td class="px-3 py-2 font-mono text-xs text-[color:var(--dashboard-text)]">
            {{ file.file }}
          </td>
          <td class="px-3 py-2">
            {{ file.type }}
          </td>
          <td class="px-3 py-2">
            {{ file.fromLabel }}
          </td>
          <td class="px-3 py-2 font-medium text-[color:var(--dashboard-text)]">
            {{ file.sizeLabel }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
