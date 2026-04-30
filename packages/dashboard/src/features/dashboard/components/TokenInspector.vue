<script setup lang="ts">
import type { DashboardTokenGroup, DashboardTokenSwatchItem } from '../types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppEmptyState from './AppEmptyState.vue'
import AppRuntimeBadge from './AppRuntimeBadge.vue'
import DashboardIcon from './DashboardIcon.vue'

type TokenGroupFilter = 'all' | DashboardTokenGroup['title']

interface TokenInspectorItem extends DashboardTokenSwatchItem {
  key: string
  groupTitle: DashboardTokenGroup['title']
  groupIconName: DashboardTokenGroup['iconName']
}

const props = defineProps<{
  groups: DashboardTokenGroup[]
}>()

const searchQuery = ref('')
const groupFilter = ref<TokenGroupFilter>('all')
const selectedTokenKey = ref<string | null>(null)
const copiedToken = ref<string | null>(null)
const failedToken = ref<string | null>(null)
let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

const allTokens = computed<TokenInspectorItem[]>(() =>
  props.groups.flatMap(group =>
    group.tokens.map(token => ({
      ...token,
      key: `${group.title}:${token.name}`,
      groupTitle: group.title,
      groupIconName: group.iconName,
    })),
  ),
)

const groupOptions = computed(() => [
  { value: 'all', label: '全部分组' },
  ...props.groups.map(group => ({ value: group.title, label: group.title })),
])

const filteredTokens = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()

  return allTokens.value.filter((token) => {
    if (groupFilter.value !== 'all' && token.groupTitle !== groupFilter.value) {
      return false
    }

    if (!keyword) {
      return true
    }

    return [
      token.name,
      token.sample,
      token.groupTitle,
    ]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
})

const selectedToken = computed(() =>
  filteredTokens.value.find(token => token.key === selectedTokenKey.value)
  ?? filteredTokens.value[0]
  ?? null,
)

const tokenSummary = computed(() => {
  const groupText = groupFilter.value === 'all' ? '全部' : groupFilter.value
  return `匹配 ${filteredTokens.value.length} / ${allTokens.value.length} 个令牌 · ${groupText}`
})

const selectedSampleStyle = computed(() => ({
  background: selectedToken.value?.sample ?? 'transparent',
}))

function clearCopyFeedback() {
  copiedToken.value = null
  failedToken.value = null
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
    throw new Error('copy token failed')
  }
}

async function copyToken(text: string) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    }
    else {
      copyTextWithFallback(text)
    }

    copiedToken.value = text
    failedToken.value = null
  }
  catch {
    copiedToken.value = null
    failedToken.value = text
  }

  scheduleCopyFeedbackClear()
}

watch(filteredTokens, (tokens) => {
  if (!tokens.some(token => token.key === selectedTokenKey.value)) {
    selectedTokenKey.value = tokens[0]?.key ?? null
  }
}, { immediate: true })

onBeforeUnmount(() => {
  if (copyFeedbackTimer) {
    clearTimeout(copyFeedbackTimer)
  }
})
</script>

<template>
  <div class="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.62fr)]">
    <div class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden">
      <div class="grid gap-3 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-3">
        <div class="grid gap-2 md:grid-cols-[minmax(0,1fr)_11rem]">
          <label class="grid gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-(--dashboard-text-soft)">
            搜索令牌
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索变量名、分组或 CSS 值"
              class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm normal-case tracking-normal text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
            >
          </label>

          <label class="grid gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-(--dashboard-text-soft)">
            分组
            <select
              v-model="groupFilter"
              class="h-9 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-2.5 text-sm normal-case tracking-normal text-(--dashboard-text) outline-none transition focus:border-(--dashboard-border-strong)"
            >
              <option
                v-for="option in groupOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
        </div>

        <p class="text-xs text-(--dashboard-text-soft)">
          {{ tokenSummary }}
        </p>
      </div>

      <AppEmptyState v-if="filteredTokens.length === 0" compact>
        当前筛选条件下没有匹配令牌。
      </AppEmptyState>

      <div v-else class="grid min-h-0 gap-2 overflow-y-auto pr-1">
        <button
          v-for="token in filteredTokens"
          :key="token.key"
          type="button"
          class="rounded-md border bg-(--dashboard-panel-muted) p-3 text-left transition focus:outline-none"
          :class="selectedToken?.key === token.key ? 'border-(--dashboard-border-strong) bg-(--dashboard-panel)' : 'border-(--dashboard-border)'"
          @click="selectedTokenKey = token.key"
        >
          <span class="flex items-center justify-between gap-3">
            <span class="flex min-w-0 items-center gap-2">
              <span class="h-4.5 w-4.5 shrink-0 text-(--dashboard-accent)">
                <DashboardIcon :name="token.groupIconName" />
              </span>
              <code class="truncate text-xs text-(--dashboard-text-soft)">{{ token.name }}</code>
            </span>
            <span
              class="h-8 w-14 shrink-0 rounded-md border border-(--dashboard-border)"
              :style="{ background: token.sample }"
            />
          </span>
          <span class="mt-2 flex items-center justify-between gap-3">
            <AppRuntimeBadge :label="token.groupTitle" tone="info" />
            <span class="truncate text-xs text-(--dashboard-text-muted)">{{ token.sample }}</span>
          </span>
        </button>
      </div>
    </div>

    <aside class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted) p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-[11px] uppercase tracking-[0.2em] text-(--dashboard-accent)">
            Selected
          </p>
          <h3 class="mt-1 text-base font-semibold">
            当前令牌
          </h3>
        </div>
        <AppRuntimeBadge
          v-if="selectedToken"
          :label="selectedToken.groupTitle"
          tone="info"
        />
      </div>

      <AppEmptyState v-if="!selectedToken" compact>
        选择左侧令牌后查看 CSS 变量详情。
      </AppEmptyState>

      <div v-else class="grid min-h-0 content-start gap-3 overflow-y-auto">
        <div
          class="min-h-28 rounded-md border border-(--dashboard-border) shadow-inner"
          :style="selectedSampleStyle"
        />

        <div class="grid gap-2">
          <code class="rounded-md bg-slate-950 px-3 py-2 font-mono text-xs leading-6 text-slate-100 dark:bg-slate-900">
            {{ selectedToken.name }}
          </code>
          <code class="rounded-md bg-slate-950 px-3 py-2 font-mono text-xs leading-6 text-slate-100 dark:bg-slate-900">
            {{ selectedToken.sample }}
          </code>
        </div>

        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm font-medium text-(--dashboard-text) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
            @click="copyToken(selectedToken.name)"
          >
            复制变量名
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-(--dashboard-border) bg-(--dashboard-panel) px-3 text-sm font-medium text-(--dashboard-text) transition hover:border-(--dashboard-border-strong) hover:text-(--dashboard-accent) focus:border-(--dashboard-border-strong) focus:outline-none"
            @click="copyToken(selectedToken.sample)"
          >
            {{ copiedToken === selectedToken.sample ? '已复制' : failedToken === selectedToken.sample ? '复制失败' : '复制 CSS 值' }}
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>
