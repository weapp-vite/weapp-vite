<script setup lang="ts">
import type { ApiCompatibility, ApiEvidence, ApiKind, ApiScope } from '../data/wevuApiCatalog'
import { Icon } from '@iconify/vue'
import { computed, ref } from 'vue'
import { wevuApiCatalog, wevuApiGroups } from '../data/wevuApiCatalog'

interface FilterOption<T extends string> {
  value: T
  label: string
  shortLabel?: string
}

const compatibilityOptions: FilterOption<ApiCompatibility>[] = [
  { value: 'vue-compatible', label: 'Vue 完全兼容', shortLabel: 'Vue 兼容' },
  { value: 'vue-different', label: 'Vue 同名有差异', shortLabel: 'Vue 差异' },
  { value: 'miniprogram-bridge', label: '小程序桥接', shortLabel: '宿主桥接' },
  { value: 'wevu-extension', label: 'Wevu 扩展' },
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

const evidenceOptions: FilterOption<ApiEvidence>[] = [
  { value: 'runtime-e2e', label: '真实 e2e 已验证', shortLabel: 'e2e 已验证' },
  { value: 'pending-e2e', label: '待补 e2e' },
]

const query = ref('')
const selectedCompatibility = ref<ApiCompatibility[]>([])
const selectedKinds = ref<ApiKind[]>([])
const selectedScopes = ref<ApiScope[]>([])
const selectedEvidence = ref<ApiEvidence[]>([])

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const hasFilters = computed(() => Boolean(
  normalizedQuery.value
  || selectedCompatibility.value.length
  || selectedKinds.value.length
  || selectedScopes.value.length
  || selectedEvidence.value.length,
))

function includesSelected<T>(selected: T[], value: T) {
  return selected.length === 0 || selected.includes(value)
}

const filteredItems = computed(() => wevuApiCatalog.filter((item) => {
  const searchText = [item.name, item.group, item.entry, ...(item.keywords || [])].join(' ').toLowerCase()
  const scopeMatched = selectedScopes.value.length === 0
    || selectedScopes.value.some(scope => item.scopes?.includes(scope))
  return (!normalizedQuery.value || searchText.includes(normalizedQuery.value))
    && includesSelected(selectedCompatibility.value, item.compatibility)
    && includesSelected(selectedKinds.value, item.kind)
    && includesSelected(selectedEvidence.value, item.evidence)
    && scopeMatched
}))

const groupedItems = computed(() => wevuApiGroups
  .map(group => ({
    name: group,
    items: filteredItems.value.filter(item => item.group === group),
  }))
  .filter(group => group.items.length > 0))

function clearFilters() {
  query.value = ''
  selectedCompatibility.value = []
  selectedKinds.value = []
  selectedScopes.value = []
  selectedEvidence.value = []
}

function compatibilityLabel(value: ApiCompatibility) {
  return compatibilityOptions.find(option => option.value === value)?.shortLabel
    || compatibilityOptions.find(option => option.value === value)?.label
}

function evidenceLabel(value: ApiEvidence) {
  return evidenceOptions.find(option => option.value === value)?.shortLabel
    || evidenceOptions.find(option => option.value === value)?.label
}
</script>

<template>
  <main class="wevu-api-reference">
    <header class="wevu-api-reference__header">
      <p class="wevu-api-reference__eyebrow">WEVU REFERENCE</p>
      <h1>API 速查</h1>
      <p>按迁移兼容性、能力类型、运行作用域与真实 e2e 证据定位 API。</p>
      <div class="wevu-api-reference__stats" aria-label="API 目录统计">
        <strong>{{ wevuApiCatalog.length }}</strong>
        <span>项公开能力</span>
        <strong>{{ wevuApiCatalog.filter(item => item.evidence === 'runtime-e2e').length }}</strong>
        <span>项真实 e2e 已验证</span>
      </div>
    </header>

    <section class="wevu-api-reference__toolbar" aria-label="API 筛选">
      <div class="wevu-api-reference__search">
        <Icon icon="mdi:magnify" aria-hidden="true" />
        <label class="wevu-api-reference__visually-hidden" for="wevu-api-filter">搜索 API</label>
        <input
          id="wevu-api-filter"
          v-model="query"
          type="search"
          placeholder="搜索 API、分组或导入入口"
        >
      </div>

      <div class="wevu-api-reference__filter-grid">
        <fieldset>
          <legend>迁移兼容性</legend>
          <label v-for="option in compatibilityOptions" :key="option.value">
            <input v-model="selectedCompatibility" type="checkbox" :value="option.value">
            <span>{{ option.label }}</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>能力类型</legend>
          <label v-for="option in kindOptions" :key="option.value">
            <input v-model="selectedKinds" type="checkbox" :value="option.value">
            <span>{{ option.label }}</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>运行作用域</legend>
          <label v-for="option in scopeOptions" :key="option.value">
            <input v-model="selectedScopes" type="checkbox" :value="option.value">
            <span>{{ option.label }}</span>
          </label>
        </fieldset>
        <fieldset>
          <legend>验证证据</legend>
          <label v-for="option in evidenceOptions" :key="option.value">
            <input v-model="selectedEvidence" type="checkbox" :value="option.value">
            <span>{{ option.label }}</span>
          </label>
        </fieldset>
      </div>
    </section>

    <div class="wevu-api-reference__result-bar" aria-live="polite">
      <span>显示 <strong>{{ filteredItems.length }}</strong> / {{ wevuApiCatalog.length }} 项</span>
      <button v-if="hasFilters" type="button" @click="clearFilters">
        <Icon icon="mdi:close" aria-hidden="true" />
        清除筛选
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
            <div class="wevu-api-reference__item-main">
              <a :href="item.href"><code>{{ item.name }}</code></a>
              <code class="wevu-api-reference__entry">{{ item.entry }}</code>
            </div>
            <div class="wevu-api-reference__tags">
              <span class="wevu-api-reference__tag" :data-compatibility="item.compatibility">
                {{ compatibilityLabel(item.compatibility) }}
              </span>
              <span class="wevu-api-reference__tag" :data-evidence="item.evidence">
                {{ evidenceLabel(item.evidence) }}
              </span>
              <span v-for="scope in item.scopes || []" :key="scope" class="wevu-api-reference__scope">
                {{ scopeOptions.find(option => option.value === scope)?.shortLabel || scope }}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <section v-else class="wevu-api-reference__empty">
      <Icon icon="mdi:file-search-outline" aria-hidden="true" />
      <h2>没有匹配的 API</h2>
      <p>调整关键词或减少筛选条件。</p>
      <button type="button" @click="clearFilters">清除筛选</button>
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
