<script setup lang="ts">
import type { ApiCompatibility, ApiEntry, ApiEntryTab, ApiPhase, ApiScope, CoreApiCategory } from '../data/wevuApiCatalog'
import { Icon } from '@iconify/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getApiEntryHref, getCoreCategoryHref, matchesWevuApiSearch, resolveWevuApiNavigation, wevuApiCatalog, wevuApiGroups, wevuCoreCategories } from '../data/wevuApiCatalog'
import { DEFAULT_API_COMPATIBILITIES, hasDefaultApiCompatibilities, resetWevuApiFacets, toggleWevuApiCompatibility } from '../data/wevuApiReferenceState'

interface FilterOption<T extends string> {
  value: T
  label: string
  shortLabel?: string
  description?: string
}

interface EntryTabOption {
  value: ApiEntryTab
  label: string
  entry: ApiEntry
  icon: string
}

const entryTabs: EntryTabOption[] = [
  { value: 'core', label: '核心 API', entry: 'wevu', icon: 'mdi:package-variant-closed' },
  { value: 'router', label: 'Router', entry: 'wevu/router', icon: 'mdi:routes' },
  { value: 'store', label: 'Store', entry: 'wevu/store', icon: 'mdi:database-outline' },
]

const compatibilityOptions: FilterOption<ApiCompatibility>[] = [
  { value: 'vue-compatible', label: 'Vue 完全兼容', shortLabel: 'Vue 兼容', description: '名称、参数和主要行为与 Vue 对应 API 保持一致' },
  { value: 'vue-compatible-with-notes', label: 'Vue 兼容（有宿主差异）', shortLabel: '兼容有说明', description: '常见迁移结果一致，但运行载体或内部机制存在无害差异' },
  { value: 'vue-different', label: 'Vue 同名有差异', shortLabel: 'Vue 差异', description: '名称相同，但参数、时机或宿主行为存在差异' },
  { value: 'miniprogram-bridge', label: '小程序桥接', shortLabel: '宿主桥接', description: '连接小程序生命周期或宿主能力，不属于 Vue API' },
  { value: 'wevu-extension', label: 'Wevu 扩展', description: 'Wevu 提供的框架扩展能力' },
  { value: 'unsupported', label: '当前不支持', shortLabel: '不支持', description: 'Vue 提供该能力，Wevu 当前没有对应实现' },
]

const phaseOptions: Record<ApiPhase, string> = {
  compile: '编译期',
  runtime: '运行时',
  type: '类型层',
}

const scopeOptions: FilterOption<ApiScope>[] = [
  { value: 'app', label: 'App' },
  { value: 'page', label: 'Page' },
  { value: 'component', label: 'Component', shortLabel: 'Comp' },
]

const query = ref('')
const activeEntry = ref<ApiEntryTab>('core')
const activeCategory = ref<CoreApiCategory>('all')
const selectedCompatibilities = ref<ApiCompatibility[]>([...DEFAULT_API_COMPATIBILITIES])
const selectedScope = ref<'all' | ApiScope>('all')

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const activeEntryOption = computed(() => entryTabs.find(tab => tab.value === activeEntry.value) || entryTabs[0])
const entryItems = computed(() => wevuApiCatalog.filter(item => item.entry === activeEntryOption.value.entry))
const activeCategoryOption = computed(() => wevuCoreCategories.find(category => category.value === activeCategory.value) || wevuCoreCategories[0])
const activeItems = computed(() => activeEntry.value === 'core' && activeCategoryOption.value.group
  ? entryItems.value.filter(item => item.group === activeCategoryOption.value.group)
  : entryItems.value)
const availableCompatibilityOptions = computed(() => compatibilityOptions.filter(option => activeItems.value.some(item => item.compatibility === option.value)))
const availableScopeOptions = computed(() => scopeOptions.filter(option => activeItems.value.some(item => item.scopes?.includes(option.value))))
const hasFilters = computed(() => Boolean(
  normalizedQuery.value
  || !hasDefaultApiCompatibilities(selectedCompatibilities.value)
  || selectedScope.value !== 'all',
))

const filteredItems = computed(() => activeItems.value.filter((item) => {
  return matchesWevuApiSearch(item, normalizedQuery.value)
    && selectedCompatibilities.value.includes(item.compatibility)
    && (selectedScope.value === 'all' || item.scopes?.includes(selectedScope.value))
}))

const groupedItems = computed(() => wevuApiGroups
  .map(group => ({
    name: group,
    items: filteredItems.value.filter(item => item.group === group),
  }))
  .filter(group => group.items.length > 0))
const viewKey = computed(() => `${activeEntry.value}:${activeCategory.value}`)

function clearFacetFilters() {
  const nextState = resetWevuApiFacets({
    query: query.value,
    compatibilities: selectedCompatibilities.value,
    scope: selectedScope.value,
  })
  query.value = nextState.query
  selectedCompatibilities.value = nextState.compatibilities
  selectedScope.value = nextState.scope
}

function clearFilters() {
  query.value = ''
  clearFacetFilters()
}

function selectEntry(value: ApiEntryTab) {
  if (activeEntry.value === value) {
    return
  }
  activeEntry.value = value
  activeCategory.value = 'all'
  clearFacetFilters()
  window.history.pushState({}, '', getApiEntryHref(value))
}

function selectCategory(value: CoreApiCategory) {
  if (activeCategory.value === value) {
    return
  }
  activeCategory.value = value
  clearFacetFilters()
  window.history.pushState({}, '', getCoreCategoryHref(value))
}

function syncEntryFromHistory() {
  const navigation = resolveWevuApiNavigation(new URL(window.location.href))
  activeEntry.value = navigation.entry
  activeCategory.value = navigation.category
  clearFacetFilters()
}

function compatibilityOption(value: ApiCompatibility) {
  return compatibilityOptions.find(option => option.value === value)
}

function toggleCompatibility(value: ApiCompatibility) {
  selectedCompatibilities.value = toggleWevuApiCompatibility(selectedCompatibilities.value, value)
}

function selectedEntryCount(entry: ApiEntry) {
  return wevuApiCatalog.filter(item => item.entry === entry && selectedCompatibilities.value.includes(item.compatibility)).length
}

function selectedCategoryCount(group?: string) {
  return entryItems.value.filter(item => (!group || item.group === group) && selectedCompatibilities.value.includes(item.compatibility)).length
}

onMounted(() => {
  syncEntryFromHistory()
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
        :href="getApiEntryHref(tab.value)"
        :aria-current="activeEntry === tab.value ? 'page' : undefined"
        @click.prevent="selectEntry(tab.value)"
      >
        <Icon :icon="tab.icon" aria-hidden="true" />
        <span>{{ tab.label }}</span>
        <small>{{ selectedEntryCount(tab.entry) }}</small>
      </a>
    </nav>

    <nav v-if="activeEntry === 'core'" class="wevu-api-reference__category-tabs" aria-label="核心 API 分类">
      <a
        v-for="category in wevuCoreCategories"
        :key="category.value"
        :href="getCoreCategoryHref(category.value)"
        :aria-current="activeCategory === category.value ? 'page' : undefined"
        @click.prevent="selectCategory(category.value)"
      >
        <span>{{ category.label }}</span>
        <small>{{ selectedCategoryCount(category.group) }}</small>
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
        <label
          v-for="option in availableCompatibilityOptions"
          :key="option.value"
          :title="option.description"
          :data-compatibility="option.value"
        >
          <input
            type="checkbox"
            :checked="selectedCompatibilities.includes(option.value)"
            @change="toggleCompatibility(option.value)"
          >
          <Icon
            class="wevu-api-reference__compatibility-icon"
            :class="{ 'is-selected': selectedCompatibilities.includes(option.value) }"
            :icon="selectedCompatibilities.includes(option.value) ? 'mdi:check-circle' : 'mdi:checkbox-blank-circle-outline'"
            aria-hidden="true"
          />
          <span>{{ option.shortLabel || option.label }}</span>
        </label>
      </div>

      <div class="wevu-api-reference__secondary-filters">
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

    <Transition name="wevu-api-view" mode="out-in">
      <div :key="viewKey" class="wevu-api-reference__view">
        <div class="wevu-api-reference__result-bar" aria-live="polite">
          <span><strong>{{ filteredItems.length }}</strong> 个条目</span>
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
                <a
                  :href="item.href"
                  class="wevu-api-reference__item-link"
                  :target="item.href.startsWith('https://') ? '_blank' : undefined"
                  :rel="item.href.startsWith('https://') ? 'noreferrer' : undefined"
                >
                  <span class="wevu-api-reference__item-main">
                    <code>{{ item.name }}</code>
                    <Icon icon="mdi:arrow-top-right" aria-hidden="true" />
                  </span>
                  <span v-if="item.transform" class="wevu-api-reference__transform">
                    <Icon icon="mdi:arrow-right" aria-hidden="true" />
                    <code>{{ item.transform }}</code>
                  </span>
                  <span class="wevu-api-reference__description">{{ item.description }}</span>
                  <span class="wevu-api-reference__meta">
                    <span
                      class="wevu-api-reference__tag"
                      :data-compatibility="item.compatibility"
                      :title="compatibilityOption(item.compatibility)?.description"
                    >
                      {{ compatibilityOption(item.compatibility)?.shortLabel || compatibilityOption(item.compatibility)?.label }}
                    </span>
                    <span class="wevu-api-reference__details">
                      <span>{{ phaseOptions[item.phase] }}</span>
                      <span v-if="item.kind === 'type'">TypeScript</span>
                      <span v-if="item.scopes?.length" class="wevu-api-reference__scopes">
                        {{ item.scopes.map(scope => scopeOptions.find(option => option.value === scope)?.shortLabel || scope).join(' / ') }}
                      </span>
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
          <button type="button" @click="clearFilters">
            重置筛选
          </button>
        </section>
      </div>
    </Transition>
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
