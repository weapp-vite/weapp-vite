<script setup lang="ts">
import type { PackageInsight } from '../types'
import { formatBytes, formatPackageType } from '../utils/format'
import { surfaceStyles } from '../utils/styles'
import AppMetricTile from './AppMetricTile.vue'
import AppPackageFileTable from './AppPackageFileTable.vue'
import AppPanelHeader from './AppPanelHeader.vue'

defineProps<{
  packageInsights: PackageInsight[]
}>()
</script>

<template>
  <section class="grid gap-3">
    <div class="grid gap-3 xl:grid-cols-2">
      <article
        v-for="pkg in packageInsights"
        :key="pkg.id"
        :class="surfaceStyles({ padding: 'md' })"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <AppPanelHeader
              icon-name="tab-packages"
              :title="pkg.label"
              :description="formatPackageType(pkg.type)"
            />
            <p class="mt-2 text-sm text-[color:var(--dashboard-text-soft)]">
              {{ formatPackageType(pkg.type) }} · {{ pkg.fileCount }} 个产物 · {{ pkg.moduleCount }} 个模块
            </p>
          </div>
          <div class="text-right">
            <p class="text-xl font-semibold text-[color:var(--dashboard-text)]">
              {{ formatBytes(pkg.totalBytes) }}
            </p>
            <p class="text-xs text-[color:var(--dashboard-text-soft)]">
              {{ pkg.entryFileCount }} 个 entry
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
          <AppMetricTile label="Chunks" :value="pkg.chunkCount" />
          <AppMetricTile label="Assets" :value="pkg.assetCount" />
          <AppMetricTile label="模块数" :value="pkg.moduleCount" />
          <AppMetricTile label="跨包模块" :value="pkg.duplicateModuleCount" />
        </div>

        <div class="mt-4">
          <AppPackageFileTable :files="pkg.topFiles" />
        </div>
      </article>
    </div>
  </section>
</template>
