<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppIconFeatureCard from '../features/dashboard/components/AppIconFeatureCard.vue'
import AppInsetPanel from '../features/dashboard/components/AppInsetPanel.vue'
import AppSectionHeading from '../features/dashboard/components/AppSectionHeading.vue'
import AppSurfaceCard from '../features/dashboard/components/AppSurfaceCard.vue'
import DashboardIcon from '../features/dashboard/components/DashboardIcon.vue'
import { useDashboardWorkspace } from '../features/dashboard/composables/useDashboardWorkspace'
import { workspaceNavigation } from '../features/dashboard/constants/shell'

const { commandItems, signals } = useDashboardWorkspace()
const copiedCommand = ref<string | null>(null)
const failedCommand = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

function clearCopyFeedback() {
  copiedCommand.value = null
  failedCommand.value = null
}

function scheduleCopyFeedbackClear() {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }

  copyFeedbackTimer = setTimeout(() => {
    clearCopyFeedback()
    copyFeedbackTimer = null
  }, 1800)
}

function copyTextWithFallback(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()

  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)

  if (!copied) {
    throw new Error('copy command failed')
  }
}

async function copyCommand(command: string) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(command)
    }
    else {
      copyTextWithFallback(command)
    }

    copiedCommand.value = command
    failedCommand.value = null
  }
  catch {
    copiedCommand.value = null
    failedCommand.value = command
  }

  scheduleCopyFeedbackClear()
}

onBeforeUnmount(() => {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }
})
</script>

<template>
  <div class="grid h-full min-h-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,0.92fr)_minmax(24rem,0.72fr)]">
    <AppSurfaceCard
      eyebrow="Status"
      title="当前工作区"
      icon-name="status-live"
      tone="strong"
      padding="md"
      content-class="min-h-0 overflow-hidden"
    >
      <AppInsetPanel>
        <ul class="grid gap-2 text-sm md:grid-cols-2">
          <li
            v-for="item in signals"
            :key="item.label"
            class="flex items-center justify-between gap-3 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 py-3"
          >
            <span class="inline-flex min-w-0 items-center gap-2">
              <span class="h-4.5 w-4.5 shrink-0 text-(--dashboard-accent)">
                <DashboardIcon :name="item.iconName" />
              </span>
              <span class="truncate">{{ item.label }}</span>
            </span>
            <strong class="shrink-0 text-(--dashboard-text)">{{ item.value }}</strong>
          </li>
        </ul>
      </AppInsetPanel>

      <div class="mt-3 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        <RouterLink v-for="item in workspaceNavigation" :key="item.to" :to="item.to">
          <AppIconFeatureCard
            :icon-name="item.iconName"
            :title="item.label"
            interactive
          />
        </RouterLink>
      </div>
    </AppSurfaceCard>

    <section class="grid min-h-0 gap-3 overflow-hidden">
      <AppSurfaceCard tone="default" padding="md" content-class="min-h-0 overflow-hidden">
        <AppSectionHeading
          eyebrow="Commands"
          title="常用操作"
        />
        <div class="mt-4 grid max-h-[calc(100dvh-13rem)] gap-3 overflow-y-auto pr-1">
          <article
            v-for="command in commandItems"
            :key="command.command"
            class="rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-4"
          >
            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 class="font-medium">
                  {{ command.label }}
                </h3>
                <p class="mt-1 text-sm text-(--dashboard-text-muted)">
                  {{ command.note }}
                </p>
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <code class="max-w-full rounded-md bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100 dark:bg-slate-900 md:max-w-64">
                  {{ command.command }}
                </code>
                <button
                  class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) text-(--dashboard-text-soft) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
                  type="button"
                  :aria-label="`复制命令 ${command.command}`"
                  :title="copiedCommand === command.command ? '已复制' : failedCommand === command.command ? '复制失败' : '复制命令'"
                  @click="copyCommand(command.command)"
                >
                  <span class="h-4.5 w-4.5">
                    <DashboardIcon name="metric-copy" />
                  </span>
                </button>
                <span
                  v-if="copiedCommand === command.command || failedCommand === command.command"
                  class="w-13 text-xs font-medium text-(--dashboard-accent)"
                >
                  {{ copiedCommand === command.command ? '已复制' : '复制失败' }}
                </span>
              </div>
            </div>
          </article>
        </div>
      </AppSurfaceCard>
    </section>
  </div>
</template>
