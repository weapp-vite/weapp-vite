<script setup lang="ts">
import type { PackageInsight } from '../composables/useAnalyzeDashboardData'
import { formatBuildOrigin, formatBytes, formatPackageType } from '../utils/format'
import { iconFrameStyles, surfaceStyles } from '../utils/styles'

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
            <div class="flex items-center gap-2">
              <span :class="iconFrameStyles()">
                <span class="icon-[mdi--package-variant-closed] h-5 w-5" />
              </span>
              <div>
                <h2 class="truncate text-lg font-semibold text-[color:var(--dashboard-text)]">
                  {{ pkg.label }}
                </h2>
                <p class="mt-0.5 text-xs text-[color:var(--dashboard-text-soft)]">
                  {{ formatPackageType(pkg.type) }}
                </p>
              </div>
            </div>
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
          <div class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
              Chunks
            </p>
            <p class="mt-1.5 text-base font-semibold text-[color:var(--dashboard-text)]">
              {{ pkg.chunkCount }}
            </p>
          </div>
          <div class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
              Assets
            </p>
            <p class="mt-1.5 text-base font-semibold text-[color:var(--dashboard-text)]">
              {{ pkg.assetCount }}
            </p>
          </div>
          <div class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
              模块数
            </p>
            <p class="mt-1.5 text-base font-semibold text-[color:var(--dashboard-text)]">
              {{ pkg.moduleCount }}
            </p>
          </div>
          <div class="rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-3">
            <p class="text-[11px] uppercase tracking-[0.18em] text-[color:var(--dashboard-text-soft)]">
              跨包模块
            </p>
            <p class="mt-1.5 text-base font-semibold text-[color:var(--dashboard-text)]">
              {{ pkg.duplicateModuleCount }}
            </p>
          </div>
        </div>

        <div class="mt-4 overflow-hidden rounded-xl border border-[color:var(--dashboard-border)]">
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
              <tr v-for="file in pkg.topFiles" :key="file.file">
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
      </article>
    </div>
  </section>
</template>
