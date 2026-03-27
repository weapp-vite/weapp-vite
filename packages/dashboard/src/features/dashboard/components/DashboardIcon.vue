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
  <span v-else-if="name === 'nav-menu'" class="icon-[mdi--menu] h-full w-full" />
  <span v-else-if="name === 'nav-home'" class="icon-[mdi--view-grid-outline] h-full w-full" />
  <span v-else-if="name === 'nav-analyze'" class="icon-[mdi--chart-box-outline] h-full w-full" />
  <span v-else-if="name === 'nav-activity'" class="icon-[mdi--timeline-text-outline] h-full w-full" />
  <span v-else-if="name === 'nav-tokens'" class="icon-[mdi--palette-outline] h-full w-full" />
  <span v-else-if="name === 'tab-overview'" class="icon-[mdi--view-dashboard-outline] h-full w-full" />
  <span v-else-if="name === 'tab-packages'" class="icon-[mdi--package-variant-closed] h-full w-full" />
  <span v-else-if="name === 'tab-modules'" class="icon-[mdi--vector-link] h-full w-full" />
  <span v-else-if="name === 'status-dark'" class="icon-[mdi--circle-slice-8] h-full w-full" />
  <span v-else-if="name === 'status-light'" class="icon-[mdi--checkbox-blank-circle] h-full w-full" />
  <span v-else-if="name === 'status-live'" class="icon-[mdi--motion-play-outline] h-full w-full" />
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
  <span v-else-if="name === 'hero-workspace'" class="icon-[mdi--view-quilt-outline] h-full w-full" />
  <span v-else-if="name === 'hero-commands'" class="icon-[mdi--console-line] h-full w-full" />
  <span v-else-if="name === 'hero-system'" class="icon-[mdi--shape-outline] h-full w-full" />
  <span v-else-if="name === 'metric-ready'" class="icon-[mdi--rocket-launch-outline] h-full w-full" />
  <span v-else-if="name === 'metric-health'" class="icon-[mdi--heart-pulse] h-full w-full" />
  <span v-else-if="name === 'metric-latency'" class="icon-[mdi--timer-sand] h-full w-full" />
  <span v-else-if="name === 'metric-quality'" class="icon-[mdi--shield-check-outline] h-full w-full" />
  <span v-else-if="name === 'token-color'" class="icon-[mdi--palette-outline] h-full w-full" />
  <span v-else-if="name === 'token-surface'" class="icon-[mdi--card-bulleted-outline] h-full w-full" />
  <span v-else-if="name === 'token-type'" class="icon-[mdi--format-letter-spacing] h-full w-full" />
  <span v-else class="icon-[mdi--file-document-multiple-outline] h-full w-full" />
</template>
