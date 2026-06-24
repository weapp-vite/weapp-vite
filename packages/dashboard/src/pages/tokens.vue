<script setup lang="ts">
import type { DashboardIconFeatureItem, DashboardSurfaceSampleItem } from '../features/dashboard/types'
import AppIconFeatureCard from '../features/dashboard/components/AppIconFeatureCard.vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import AppSurfaceSampleCard from '../features/dashboard/components/AppSurfaceSampleCard.vue'
import TokenInspector from '../features/dashboard/components/TokenInspector.vue'
import { tokenGroups } from '../features/dashboard/constants/shell'
import { themeOptions } from '../features/dashboard/constants/view'

const surfaceSamples: DashboardSurfaceSampleItem[] = [
  { label: 'Default surface', tone: 'default' },
  { label: 'Strong surface', tone: 'strong' },
  { label: 'Muted surface', tone: 'muted' },
]

const themeFeatureItems: DashboardIconFeatureItem[] = themeOptions.map(option => ({
  iconName: option.iconName,
  title: option.label,
  meta: option.value,
}))
</script>

<template>
  <div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden">
    <AppSurfaceCard tone="strong" padding="md">
      <AppSectionHeading
        eyebrow="System"
        title="设计令牌"
      />
      <div class="mt-4 grid gap-3 lg:grid-cols-3">
        <AppIconFeatureCard
          v-for="item in themeFeatureItems"
          :key="item.meta"
          v-bind="item"
        />
      </div>
    </AppSurfaceCard>

    <section class="grid min-h-0 overflow-hidden">
      <AppSurfaceCard
        eyebrow="Tokens"
        title="令牌检查器"
        icon-name="token-color"
        padding="md"
        content-class="min-h-0 overflow-hidden"
      >
        <TokenInspector :groups="tokenGroups" />
      </AppSurfaceCard>
    </section>

    <section class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <AppSurfaceCard
        eyebrow="Components"
        title="标准表面"
        icon-name="token-surface"
      >
        <div class="grid gap-3 md:grid-cols-3">
          <AppSurfaceSampleCard
            v-for="sample in surfaceSamples"
            :key="sample.label"
            v-bind="sample"
          />
        </div>
      </AppSurfaceCard>

      <AppSurfaceCard
        eyebrow="Typography"
        title="文本层级"
        icon-name="token-type"
      >
        <div class="space-y-3">
          <p class="text-2xl font-semibold tracking-tight">
            IBM Plex Sans Console
          </p>
          <p class="text-sm uppercase tracking-[0.24em] text-(--dashboard-text-soft)">
            uppercased meta labels for control surfaces
          </p>
        </div>
      </AppSurfaceCard>
    </section>
  </div>
</template>
