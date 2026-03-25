<script setup lang="ts">
import type { DashboardIconName } from '../types'

defineProps<{
  name: DashboardIconName
}>()
</script>

<template>
  <span v-if="name === 'theme-system'" class="icon-[mdi--theme-light-dark] h-full w-full" />
  <span v-else-if="name === 'theme-light'" class="icon-[mdi--white-balance-sunny] h-full w-full" />
  <span v-else-if="name === 'theme-dark'" class="icon-[mdi--moon-waning-crescent] h-full w-full" />
  <span v-else-if="name === 'tab-overview'" class="icon-[mdi--view-dashboard-outline] h-full w-full" />
  <span v-else-if="name === 'tab-packages'" class="icon-[mdi--package-variant-closed] h-full w-full" />
  <span v-else-if="name === 'tab-modules'" class="icon-[mdi--vector-link] h-full w-full" />
  <span v-else-if="name === 'status-dark'" class="icon-[mdi--circle-slice-8] h-full w-full" />
  <span v-else-if="name === 'status-light'" class="icon-[mdi--checkbox-blank-circle] h-full w-full" />
  <span v-else-if="name === 'metric-packages'" class="icon-[mdi--package-variant] h-full w-full" />
  <span v-else-if="name === 'metric-subpackages'" class="icon-[mdi--layers-triple-outline] h-full w-full" />
  <span v-else-if="name === 'metric-chunks'" class="icon-[mdi--chart-tree] h-full w-full" />
  <span v-else-if="name === 'metric-assets'" class="icon-[mdi--file-document-multiple-outline] h-full w-full" />
  <span v-else-if="name === 'metric-size-outline'" class="icon-[mdi--database-outline] h-full w-full" />
  <span v-else-if="name === 'metric-modules'" class="icon-[mdi--cube-outline] h-full w-full" />
  <span v-else-if="name === 'metric-duplicates'" class="icon-[mdi--vector-link] h-full w-full" />
  <span v-else-if="name === 'metric-sources'" class="icon-[mdi--source-branch] h-full w-full" />
  <span v-else-if="name === 'metric-copy'" class="icon-[mdi--content-copy] h-full w-full" />
  <span v-else-if="name === 'metric-time'" class="icon-[mdi--clock-outline] h-full w-full" />
  <span v-else-if="name === 'metric-entries'" class="icon-[mdi--export-variant] h-full w-full" />
  <span v-else-if="name === 'metric-size'" class="icon-[mdi--database] h-full w-full" />
  <span v-else-if="name === 'treemap'" class="icon-[mdi--chart-box-outline] h-full w-full" />
  <span v-else-if="name === 'top-files'" class="icon-[mdi--file-star-outline] h-full w-full" />
  <span v-else-if="name === 'subpackages'" class="icon-[mdi--layers-triple-outline] h-full w-full" />
  <span v-else-if="name === 'duplicate-modules'" class="icon-[mdi--vector-link] h-full w-full" />
  <span v-else-if="name === 'module-sources'" class="icon-[mdi--source-branch] h-full w-full" />
  <span v-else class="icon-[mdi--file-document-multiple-outline] h-full w-full" />
</template>
