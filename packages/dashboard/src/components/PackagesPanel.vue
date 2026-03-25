<script setup lang="ts">
import type { PackageInsight } from '../useAnalyzeDashboardData'
import { formatBuildOrigin, formatBytes, formatPackageType } from '../format'

defineProps<{
  packageInsights: PackageInsight[]
}>()
</script>

<template>
  <section class="grid gap-6">
    <div class="grid gap-4 xl:grid-cols-2">
      <article
        v-for="pkg in packageInsights"
        :key="pkg.id"
        class="rounded-[24px] border border-white/10 bg-slate-900/70 p-5"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-white">
              {{ pkg.label }}
            </h2>
            <p class="mt-1 text-sm text-slate-400">
              {{ formatPackageType(pkg.type) }} · {{ pkg.fileCount }} 个产物 · {{ pkg.moduleCount }} 个模块
            </p>
          </div>
          <div class="text-right">
            <p class="text-2xl font-semibold text-cyan-200">
              {{ formatBytes(pkg.totalBytes) }}
            </p>
            <p class="text-xs text-slate-400">
              {{ pkg.entryFileCount }} 个 entry
            </p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p class="text-xs text-slate-400">
              Chunks
            </p>
            <p class="mt-2 text-lg font-semibold text-white">
              {{ pkg.chunkCount }}
            </p>
          </div>
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p class="text-xs text-slate-400">
              Assets
            </p>
            <p class="mt-2 text-lg font-semibold text-white">
              {{ pkg.assetCount }}
            </p>
          </div>
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p class="text-xs text-slate-400">
              模块数
            </p>
            <p class="mt-2 text-lg font-semibold text-white">
              {{ pkg.moduleCount }}
            </p>
          </div>
          <div class="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
            <p class="text-xs text-slate-400">
              跨包模块
            </p>
            <p class="mt-2 text-lg font-semibold text-white">
              {{ pkg.duplicateModuleCount }}
            </p>
          </div>
        </div>

        <div class="mt-5 overflow-hidden rounded-2xl border border-white/8">
          <table class="min-w-full divide-y divide-white/8 text-left text-sm">
            <thead class="bg-white/[0.03] text-slate-400">
              <tr>
                <th class="px-4 py-3 font-medium">
                  文件
                </th>
                <th class="px-4 py-3 font-medium">
                  类型
                </th>
                <th class="px-4 py-3 font-medium">
                  来源
                </th>
                <th class="px-4 py-3 font-medium">
                  体积
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/6 text-slate-200">
              <tr v-for="file in pkg.topFiles" :key="file.file">
                <td class="px-4 py-3 font-mono text-xs">
                  {{ file.file }}
                </td>
                <td class="px-4 py-3">
                  {{ file.type }}
                </td>
                <td class="px-4 py-3">
                  {{ formatBuildOrigin(file.from) }}
                </td>
                <td class="px-4 py-3">
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
