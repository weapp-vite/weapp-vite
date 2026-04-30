<script setup lang="ts">
import type { DashboardIconName } from '../types'
import { computed } from 'vue'

const props = defineProps<{
  name: DashboardIconName
}>()

const ICON_CLASS_MAP: Record<DashboardIconName, string> = {
  'theme-system': 'icon-[mdi--theme-light-dark]',
  'theme-light': 'icon-[mdi--white-balance-sunny]',
  'theme-dark': 'icon-[mdi--moon-waning-crescent]',
  'nav-menu': 'icon-[mdi--menu]',
  'nav-home': 'icon-[mdi--view-grid-outline]',
  'nav-analyze': 'icon-[mdi--chart-box-outline]',
  'nav-activity': 'icon-[mdi--timeline-text-outline]',
  'nav-tokens': 'icon-[mdi--palette-outline]',
  'tab-overview': 'icon-[mdi--view-dashboard-outline]',
  'tab-packages': 'icon-[mdi--package-variant-closed]',
  'tab-modules': 'icon-[mdi--vector-link]',
  'status-dark': 'icon-[mdi--circle-slice-8]',
  'status-light': 'icon-[mdi--checkbox-blank-circle]',
  'status-live': 'icon-[mdi--motion-play-outline]',
  'metric-packages': 'icon-[mdi--package-variant]',
  'metric-subpackages': 'icon-[mdi--layers-triple-outline]',
  'metric-chunks': 'icon-[mdi--chart-tree]',
  'metric-assets': 'icon-[mdi--file-document-multiple-outline]',
  'metric-size-outline': 'icon-[mdi--database-outline]',
  'metric-modules': 'icon-[mdi--cube-outline]',
  'metric-duplicates': 'icon-[mdi--vector-link]',
  'metric-sources': 'icon-[mdi--source-branch]',
  'metric-copy': 'icon-[mdi--content-copy]',
  'metric-time': 'icon-[mdi--clock-outline]',
  'metric-entries': 'icon-[mdi--export-variant]',
  'metric-size': 'icon-[mdi--database]',
  'treemap': 'icon-[mdi--chart-box-outline]',
  'top-files': 'icon-[mdi--file-star-outline]',
  'subpackages': 'icon-[mdi--layers-triple-outline]',
  'duplicate-modules': 'icon-[mdi--vector-link]',
  'module-sources': 'icon-[mdi--source-branch]',
  'file-samples': 'icon-[mdi--file-document-outline]',
  'hero-workspace': 'icon-[mdi--view-quilt-outline]',
  'hero-commands': 'icon-[mdi--console-line]',
  'hero-system': 'icon-[mdi--shape-outline]',
  'metric-ready': 'icon-[mdi--rocket-launch-outline]',
  'metric-health': 'icon-[mdi--heart-pulse]',
  'metric-latency': 'icon-[mdi--timer-sand]',
  'metric-quality': 'icon-[mdi--shield-check-outline]',
  'metric-search': 'icon-[mdi--magnify]',
  'token-color': 'icon-[mdi--palette-outline]',
  'token-surface': 'icon-[mdi--card-bulleted-outline]',
  'token-type': 'icon-[mdi--format-letter-spacing]',
}

const iconClassName = computed(() => ICON_CLASS_MAP[props.name] ?? 'icon-[mdi--file-document-multiple-outline]')
</script>

<template>
  <span class="h-full w-full" :class="iconClassName" />
</template>
