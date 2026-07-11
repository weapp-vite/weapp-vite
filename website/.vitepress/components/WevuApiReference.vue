<script setup lang="ts">
import type { ApiCompatibility, ApiEntry, ApiKind, ApiScope } from '../data/wevuApiCatalog'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { wevuApiCatalog, wevuApiGroups } from '../data/wevuApiCatalog'

interface FilterOption<T extends string> {
  value: T
  label: string
  shortLabel?: string
  description?: string
}

type EntryTab = 'core' | 'router' | 'store'

interface EntryTabOption {
  value: EntryTab
  label: string
  entry: ApiEntry
}

const entryTabs: EntryTabOption[] = [
  { value: 'core', label: '核心 API', entry: 'wevu' },
  { value: 'router', label: 'Router', entry: 'wevu/router' },
  { value: 'store', label: 'Store', entry: 'wevu/store' },
]

const compatibilityOptions: FilterOption<ApiCompatibility>[] = [
  { value: 'vue-compatible', label: 'Vue 完全兼容', shortLabel: 'Vue 兼容', description: '名称、参数和主要行为与 Vue 对应 API 保持一致' },
  { value: 'vue-different', label: 'Vue 同名有差异', shortLabel: 'Vue 差异', description: '名称相同，但参数、时机或宿主行为存在差异' },
  { value: 'miniprogram-bridge', label: '小程序桥接', shortLabel: '宿主桥接', description: '连接小程序生命周期或宿主能力，不属于 Vue API' },
  { value: 'wevu-extension', label: 'Wevu 扩展', description: 'Wevu 提供的框架扩展能力' },
]

const kindOptions: FilterOption<ApiKind>[] = [
  { value: 'global', label: '全局 API' },
  { value: 'macro', label: '编译宏' },
  { value: 'reactivity', label: '响应式' },
  { value: 'lifecycle', label: '生命周期' },
  { value: 'setup', label: 'Setup 工具' },
  { value: 'options', label: 'Options API' },
  { value: 'store', label: 'Store' },
  { value: 'runtime', label: '运行时' },
]

const scopeOptions: FilterOption<ApiScope>[] = [
  { value: 'app', label: 'App' },
  { value: 'page', label: 'Page' },
  { value: 'component', label: 'Component', shortLabel: 'Comp' },
]

const query = ref('')
const activeEntry = ref<EntryTab>('core')
const selectedCompatibility = ref<'all' | ApiCompatibility>('all')
const selectedKind = ref<'all' | ApiKind>('all')
const selectedScope = ref<'all' | ApiScope>('all')

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const activeEntryOption = computed(() => entryTabs.find(tab => tab.value === activeEntry.value) || entryTabs[0])
const activeItems = computed(() => wevuApiCatalog.filter(item => item.entry === activeEntryOption.value.entry))
const availableCompatibilityOptions = computed(() => compatibilityOptions.filter(option => activeItems.value.some(item => item.compatibility === option.value)))
const availableKindOptions = computed(() => kindOptions.filter(option => activeItems.value.some(item => item.kind === option.value)))
const availableScopeOptions = computed(() => scopeOptions.filter(option => activeItems.value.some(item => item.scopes?.includes(option.value))))
const hasFilters = computed(() => Boolean(
  normalizedQuery.value
  || selectedCompatibility.value !== 'all'
  || selectedKind.value !== 'all'
  || selectedScope.value !== 'all',
))

const filteredItems = computed(() => activeItems.value.filter((item) => {
  const searchText = [item.name, item.group, item.entry, ...(item.keywords || [])].join(' ').toLowerCase()
  return (!normalizedQuery.value || searchText.includes(normalizedQuery.value))
    && (selectedCompatibility.value === 'all' || item.compatibility === selectedCompatibility.value)
    && (selectedKind.value === 'all' || item.kind === selectedKind.value)
    && (selectedScope.value === 'all' || item.scopes?.includes(selectedScope.value))
}))

const groupedItems = computed(() => wevuApiGroups
  .map(group => ({
    name: group,
    items: filteredItems.value.filter(item => item.group === group),
  }))
  .filter(group => group.items.length > 0))

function clearFilters() {
  query.value = ''
  selectedCompatibility.value = 'all'
  selectedKind.value = 'all'
  selectedScope.value = 'all'
}

function entryHref(value: EntryTab) {
  return value === 'core' ? '/wevu/api/' : `/wevu/api/?entry=${value}`
}

function entryFromLocation(): EntryTab {
  if (typeof window === 'undefined') {
    return 'core'
  }
  const value = new URL(window.location.href).searchParams.get('entry')
  return value === 'router' || value === 'store' ? value : 'core'
}

function selectEntry(value: EntryTab) {
  if (activeEntry.value === value) {
    return
  }
  activeEntry.value = value
  clearFilters()
  window.history.pushState({}, '', entryHref(value))
}

function syncEntryFromHistory() {
  activeEntry.value = entryFromLocation()
  clearFilters()
}

function compatibilityOption(value: ApiCompatibility) {
  return compatibilityOptions.find(option => option.value === value)
}

onMounted(() => {
  activeEntry.value = entryFromLocation()
  window.addEventListener('popstate', syncEntryFromHistory)
})

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncEntryFromHistory)
})
</script>

<template>
  <main class="wevu-api-reference">
    <header class="wevu-api-reference__header">
      <h1>Wevu API</h1>
      <p>快速确认 API 的 Vue 兼容程度、适用范围与导入入口。</p>
    </header>

    <nav class="wevu-api-reference__entry-tabs" aria-label="API 模块">
      <a
        v-for="tab in entryTabs"
        :key="tab.value"
        :href="entryHref(tab.value)"
        :aria-current="activeEntry === tab.value ? 'page' : undefined"
        @click.prevent="selectEntry(tab.value)"
      >
        <span>{{ tab.label }}</span>
        <small>{{ wevuApiCatalog.filter(item => item.entry === tab.entry).length }}</small>
      </a>
    </nav>

    <section class="wevu-api-reference__tools" aria-label="API 筛选">
      <div class="wevu-api-reference__search">
        <Icon icon="mdi:magnify" aria-hidden="true" />
        <label class="wevu-api-reference__visually-hidden" for="wevu-api-filter">搜索 API</label>
        <input
          id="wevu-api-filter"
          v-model="query"
          type="search"
          placeholder="搜索 API，例如 ref、router、lifecycle"
        >
        <button v-if="query" type="button" title="清空搜索" aria-label="清空搜索" @click="query = ''">
          <Icon icon="mdi:close" aria-hidden="true" />
        </button>
      </div>

      <div class="wevu-api-reference__compatibility" aria-label="按迁移兼容性筛选">
        <button
          type="button"
          :aria-pressed="selectedCompatibility === 'all'"
          @click="selectedCompatibility = 'all'"
        >
          全部
        </button>
        <button
          v-for="option in availableCompatibilityOptions"
          :key="option.value"
          type="button"
          :title="option.description"
          :data-compatibility="option.value"
          :aria-pressed="selectedCompatibility === option.value"
          @click="selectedCompatibility = option.value"
        >
          {{ option.shortLabel || option.label }}
        </button>
      </div>

      <div class="wevu-api-reference__secondary-filters">
        <label>
          <span>类型</span>
          <select v-model="selectedKind">
            <option value="all">全部类型</option>
            <option v-for="option in availableKindOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <label>
          <span>作用域</span>
          <select v-model="selectedScope">
            <option value="all">全部作用域</option>
            <option v-for="option in availableScopeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
    </section>

    <div class="wevu-api-reference__result-bar" aria-live="polite">
      <span><strong>{{ filteredItems.length }}</strong> 个 API</span>
      <button v-if="hasFilters" type="button" @click="clearFilters">
        重置筛选
      </button>
    </div>

    <div v-if="groupedItems.length" class="wevu-api-reference__groups">
      <section v-for="group in groupedItems" :key="group.name" class="wevu-api-reference__group">
        <div class="wevu-api-reference__group-heading">
          <h2>{{ group.name }}</h2>
          <span>{{ group.items.length }}</span>
        </div>
        <ul>
          <li v-for="item in group.items" :key="`${item.entry}:${item.name}`">
            <a :href="item.href" class="wevu-api-reference__item-link">
              <span class="wevu-api-reference__item-main">
                <code>{{ item.name }}</code>
                <Icon icon="mdi:arrow-top-right" aria-hidden="true" />
              </span>
              <code v-if="item.entry !== 'wevu'" class="wevu-api-reference__entry">{{ item.entry }}</code>
              <span class="wevu-api-reference__meta">
                <span
                  class="wevu-api-reference__tag"
                  :data-compatibility="item.compatibility"
                  :title="compatibilityOption(item.compatibility)?.description"
                >
                  {{ compatibilityOption(item.compatibility)?.shortLabel || compatibilityOption(item.compatibility)?.label }}
                </span>
                <span v-if="item.scopes?.length" class="wevu-api-reference__scopes">
                  {{ item.scopes.map(scope => scopeOptions.find(option => option.value === scope)?.shortLabel || scope).join(' / ') }}
                </span>
              </span>
            </a>
          </li>
        </ul>
      </section>
    </div>

    <section v-else class="wevu-api-reference__empty">
      <Icon icon="mdi:file-search-outline" aria-hidden="true" />
      <h2>没有找到匹配项</h2>
      <p>换一个关键词，或重置当前筛选。</p>
      <button type="button" @click="clearFilters">重置筛选</button>
    </section>
  </main>
</template>

<style>
/* stylelint-disable-next-line selector-class-pattern */
.Layout.wevu-api-home .VPDoc .content {
  max-width: 1180px !important;
}

/* stylelint-disable-next-line selector-class-pattern */
.Layout.wevu-api-home .VPDoc .content-container {
  max-width: 1080px !important;
}
</style>

<style scoped src="./WevuApiReferenceControls.css"></style>

<style scoped src="./WevuApiReferenceList.css"></style>
