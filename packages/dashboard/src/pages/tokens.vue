<script setup lang="ts">
import AppIconFeatureCard from '../features/dashboard/components/AppIconFeatureCard.vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import AppTokenSwatch from '../features/dashboard/components/AppTokenSwatch.vue'
import { tokenGroups } from '../features/dashboard/constants/shell'
import { themeOptions } from '../features/dashboard/constants/view'
</script>

<template>
  <div class="grid gap-3">
    <AppSurfaceCard tone="strong" padding="md">
      <AppSectionHeading
        eyebrow="System"
        title="设计令牌与组件语义"
        description="这个页面不是给最终用户看的功能页，而是给 dashboard 自己看的设计控制台。后面改视觉体系时，先看这里再改其它页面。"
      />
      <div class="mt-5 grid gap-3 lg:grid-cols-3">
        <AppIconFeatureCard
          v-for="option in themeOptions"
          :key="option.value"
          :icon-name="option.iconName"
          :title="option.label"
          :meta="option.value"
        />
      </div>
    </AppSurfaceCard>

    <section class="grid gap-3 lg:grid-cols-3">
      <AppSurfaceCard
        v-for="group in tokenGroups"
        :key="group.title"
        :title="group.title"
        :icon-name="group.iconName"
        padding="md"
      >
        <ul class="grid gap-3">
          <AppTokenSwatch
            v-for="token in group.tokens"
            :key="token.name"
            :name="token.name"
            :sample="token.sample"
          />
        </ul>
      </AppSurfaceCard>
    </section>

    <section class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <AppSurfaceCard
        eyebrow="Components"
        title="标准表面"
        description="统一的圆角、边框和阴影会比单独页面自由发挥更重要。"
        icon-name="token-surface"
      >
        <div class="grid gap-3 md:grid-cols-3">
          <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] p-4">
            Default surface
          </div>
          <div class="rounded-[18px] border border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel-strong)] p-4 shadow-[var(--dashboard-shadow)]">
            Strong surface
          </div>
          <div class="rounded-[18px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] p-4">
            Muted surface
          </div>
        </div>
      </AppSurfaceCard>

      <AppSurfaceCard
        eyebrow="Typography"
        title="文本层级"
        description="dashboard 需要明显的技术控制台语义，而不是普通后台模板样式。"
        icon-name="token-type"
      >
        <div class="space-y-3">
          <p class="text-3xl font-semibold tracking-tight">
            IBM Plex Sans Console
          </p>
          <p class="text-base text-[color:var(--dashboard-text-muted)]">
            说明文案采用偏紧凑的行高和较高的信息密度，适合后续挂载构建分析、事件流和诊断面板。
          </p>
          <p class="text-sm uppercase tracking-[0.24em] text-[color:var(--dashboard-text-soft)]">
            uppercased meta labels for control surfaces
          </p>
        </div>
      </AppSurfaceCard>
    </section>
  </div>
</template>
