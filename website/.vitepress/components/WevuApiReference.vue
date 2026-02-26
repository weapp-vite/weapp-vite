<script setup lang="ts">
import { computed, ref } from 'vue'

interface ApiItem {
  text: string
  href: string
  scopes?: Array<'app' | 'page' | 'component'>
}

interface ApiColumn {
  title: string
  items: ApiItem[]
}

interface ApiGroup {
  title: string
  items?: ApiItem[]
  columns?: ApiColumn[]
}

interface ApiSection {
  title: string
  groups: ApiGroup[]
}

const query = ref('')

const sections: ApiSection[] = [
  {
    title: 'Global API',
    groups: [
      {
        title: 'Application / Component',
        items: [
          { text: 'createApp()', href: '/wevu/api/core#createapp' },
          { text: 'defineComponent()', href: '/wevu/api/core#definecomponent' },
        ],
      },
      {
        title: '<script setup> Macros',
        items: [
          { text: 'defineProps()', href: '/wevu/api/core#defineprops' },
          { text: 'withDefaults()', href: '/wevu/api/core#withdefaults' },
          { text: 'defineEmits()', href: '/wevu/api/core#defineemits' },
          { text: 'defineSlots()', href: '/wevu/api/core#defineslots' },
          { text: 'defineExpose()', href: '/wevu/api/core#defineexpose' },
          { text: 'defineModel()', href: '/wevu/api/core#definemodel' },
          { text: 'defineOptions()', href: '/wevu/api/core#defineoptions' },
          { text: 'mergeModels()', href: '/wevu/api/core#mergemodels' },
          { text: 'useModel()', href: '/wevu/api/core#usemodel' },
        ],
      },
    ],
  },
  {
    title: 'Composition API',
    groups: [
      {
        title: 'Reactivity: Core',
        items: [
          { text: 'ref()', href: '/wevu/api/reactivity#ref' },
          { text: 'reactive()', href: '/wevu/api/reactivity#reactive' },
          { text: 'readonly()', href: '/wevu/api/reactivity#readonly' },
          { text: 'computed()', href: '/wevu/api/reactivity#computed' },
        ],
      },
      {
        title: 'Reactivity: Watch & Scheduler',
        items: [
          { text: 'watch()', href: '/wevu/api/reactivity#watch' },
          { text: 'watchEffect()', href: '/wevu/api/reactivity#watcheffect' },
          { text: 'effect()', href: '/wevu/api/reactivity#effect' },
          { text: 'effectScope()', href: '/wevu/api/reactivity#effectscope' },
          { text: 'nextTick()', href: '/wevu/api/reactivity#nexttick' },
        ],
      },
      {
        title: 'Setup Context',
        items: [
          { text: 'getCurrentInstance()', href: '/wevu/api/setup-context#getcurrentinstance' },
          { text: 'getCurrentSetupContext()', href: '/wevu/api/setup-context#getcurrentsetupcontext' },
          { text: 'useNativeInstance()', href: '/wevu/api/setup-context#usenativeinstance' },
          { text: 'useBindModel()', href: '/wevu/api/setup-context#usebindmodel' },
          { text: 'provide()/inject()', href: '/wevu/api/setup-context#provide' },
        ],
      },
      {
        title: 'Lifecycle',
        columns: [
          {
            title: '组合式API',
            items: [
              { text: 'onLaunch()', href: '/wevu/api/lifecycle#onlaunch', scopes: ['app'] },
              { text: 'onShow()', href: '/wevu/api/lifecycle#onshow', scopes: ['app', 'page', 'component'] },
              { text: 'onHide()', href: '/wevu/api/lifecycle#onhide', scopes: ['app', 'page', 'component'] },
              { text: 'onLoad()', href: '/wevu/api/lifecycle#onload', scopes: ['page'] },
              { text: 'onReady()', href: '/wevu/api/lifecycle#onready', scopes: ['page', 'component'] },
              { text: 'onUnload()', href: '/wevu/api/lifecycle#onunload', scopes: ['page', 'component'] },
              { text: 'onAttached()', href: '/wevu/api/lifecycle#onattached', scopes: ['component'] },
              { text: 'onDetached()', href: '/wevu/api/lifecycle#ondetached', scopes: ['component'] },
              { text: 'onMounted()', href: '/wevu/api/lifecycle#onmounted', scopes: ['component'] },
              { text: 'onBeforeUnmount()', href: '/wevu/api/lifecycle#onbeforeunmount', scopes: ['component'] },
              { text: 'onUnmounted()', href: '/wevu/api/lifecycle#onunmounted', scopes: ['component'] },
              { text: 'onResize()', href: '/wevu/api/lifecycle#onresize', scopes: ['page', 'component'] },
              { text: 'onRouteDone()', href: '/wevu/api/lifecycle#onroutedone', scopes: ['page', 'component'] },
              { text: 'onPullDownRefresh()', href: '/wevu/api/lifecycle#onpulldownrefresh', scopes: ['page'] },
              { text: 'onReachBottom()', href: '/wevu/api/lifecycle#onreachbottom', scopes: ['page'] },
              { text: 'onPageScroll()', href: '/wevu/api/lifecycle#onpagescroll', scopes: ['page'] },
            ],
          },
          {
            title: 'lifetimes',
            items: [
              { text: 'lifetimes.created', href: '/wevu/api/lifecycle#lifetimes-created', scopes: ['component'] },
              { text: 'lifetimes.attached', href: '/wevu/api/lifecycle#lifetimes-attached', scopes: ['component'] },
              { text: 'lifetimes.ready', href: '/wevu/api/lifecycle#lifetimes-ready', scopes: ['component'] },
              { text: 'lifetimes.moved', href: '/wevu/api/lifecycle#lifetimes-moved', scopes: ['component'] },
              { text: 'lifetimes.detached', href: '/wevu/api/lifecycle#lifetimes-detached', scopes: ['component'] },
              { text: 'lifetimes.error', href: '/wevu/api/lifecycle#lifetimes-error', scopes: ['component'] },
            ],
          },
          {
            title: 'pageLifetimes',
            items: [
              { text: 'pageLifetimes.show', href: '/wevu/api/lifecycle#pagelifetimes-show', scopes: ['component'] },
              { text: 'pageLifetimes.hide', href: '/wevu/api/lifecycle#pagelifetimes-hide', scopes: ['component'] },
              { text: 'pageLifetimes.resize', href: '/wevu/api/lifecycle#pagelifetimes-resize', scopes: ['component'] },
              { text: 'pageLifetimes.routeDone', href: '/wevu/api/lifecycle#pagelifetimes-routedone', scopes: ['component'] },
            ],
          },
        ],
      },
    ],
  },
  {
    title: 'Runtime API',
    groups: [
      {
        title: 'Store',
        items: [
          { text: 'defineStore()', href: '/wevu/api/store#definestore' },
          { text: 'createStore()', href: '/wevu/api/store#createstore' },
          { text: 'storeToRefs()', href: '/wevu/api/store#storetorefs' },
        ],
      },
      {
        title: 'Runtime Bridge',
        items: [
          { text: 'setWevuDefaults()', href: '/wevu/api/runtime-bridge#setwevudefaults' },
          { text: 'resetWevuDefaults()', href: '/wevu/api/runtime-bridge#resetwevudefaults' },
          { text: 'addMutationRecorder()', href: '/wevu/api/runtime-bridge#addmutationrecorder' },
          { text: 'markNoSetData()', href: '/wevu/api/runtime-bridge#marknosetdata' },
        ],
      },
    ],
  },
  {
    title: 'Type Reference',
    groups: [
      {
        title: 'Types',
        items: [
          { text: 'CreateAppOptions', href: '/wevu/api/types#createappoptions' },
          { text: 'SetupContext', href: '/wevu/api/types#setupcontext' },
          { text: 'WatchOptions', href: '/wevu/api/types#watchoptions' },
          { text: 'StoreManager', href: '/wevu/api/types#storemanager' },
          { text: 'WevuDefaults', href: '/wevu/api/types#wevudefaults' },
        ],
      },
    ],
  },
]

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const filteredSections = computed(() => {
  if (!normalizedQuery.value) {
    return sections
  }

  return sections
    .map(section => ({
      ...section,
      groups: section.groups
        .map((group) => {
          const groupMatched = group.title.toLowerCase().includes(normalizedQuery.value)
            || section.title.toLowerCase().includes(normalizedQuery.value)
          if (group.columns) {
            const columns = group.columns
              .map(column => ({
                ...column,
                items: column.items.filter(item =>
                  groupMatched
                  || column.title.toLowerCase().includes(normalizedQuery.value)
                  || item.text.toLowerCase().includes(normalizedQuery.value),
                ),
              }))
              .filter(column => column.items.length > 0)
            return {
              ...group,
              columns,
              items: [],
            }
          }
          const items = (group.items || []).filter(item =>
            groupMatched || item.text.toLowerCase().includes(normalizedQuery.value),
          )
          return {
            ...group,
            items,
          }
        })
        .filter(group => (group.columns && group.columns.length > 0) || (group.items && group.items.length > 0)),
    }))
    .filter(section => section.groups.length > 0)
})

const scopeIconMap: Record<'app' | 'page' | 'component', string> = {
  app: 'App',
  page: 'Page',
  component: 'Comp',
}

const scopeLabelMap: Record<'app' | 'page' | 'component', string> = {
  app: 'App',
  page: 'Page',
  component: 'Comp',
}
</script>

<template>
  <div class="wevu-api-reference">
    <h1>API Reference</h1>
    <div class="wevu-api-reference__filter">
      <label class="wevu-api-reference__label" for="wevu-api-filter">Filter</label>
      <input
        id="wevu-api-filter"
        v-model="query"
        class="wevu-api-reference__input"
        type="search"
        placeholder="Type to filter APIs"
      >
    </div>
    <div class="wevu-api-reference__legend" aria-label="Scope legend">
      <span class="wevu-api-reference__scope wevu-api-reference__scope--app" title="App">App</span>
      <span class="wevu-api-reference__scope wevu-api-reference__scope--page" title="Page">Page</span>
      <span class="wevu-api-reference__scope wevu-api-reference__scope--component" title="Comp">Comp</span>
    </div>

    <section
      v-for="section in filteredSections"
      :key="section.title"
      class="wevu-api-reference__section"
    >
      <h2>{{ section.title }}</h2>
      <div class="wevu-api-reference__groups">
        <div
          v-for="group in section.groups"
          :key="`${section.title}-${group.title}`"
          class="wevu-api-reference__group"
          :class="{ 'wevu-api-reference__group--full': group.title === 'Lifecycle' }"
        >
          <h3>{{ group.title }}</h3>
          <div v-if="group.columns" class="wevu-api-reference__columns">
            <section
              v-for="column in group.columns"
              :key="`${group.title}-${column.title}`"
              class="wevu-api-reference__column"
            >
              <h4>{{ column.title }}</h4>
              <ul>
                <li v-for="item in column.items" :key="item.href">
                  <a :href="item.href">{{ item.text }}</a>
                  <span
                    v-for="scope in item.scopes || []"
                    :key="`${item.href}-${scope}`"
                    class="wevu-api-reference__scope"
                    :class="`wevu-api-reference__scope--${scope}`"
                    :title="scopeLabelMap[scope]"
                    :aria-label="scopeLabelMap[scope]"
                  >
                    {{ scopeIconMap[scope] }}
                  </span>
                </li>
              </ul>
            </section>
          </div>
          <ul v-else>
            <li v-for="item in group.items || []" :key="item.href">
              <a :href="item.href">{{ item.text }}</a>
              <span
                v-for="scope in item.scopes || []"
                :key="`${item.href}-${scope}`"
                class="wevu-api-reference__scope"
                :class="`wevu-api-reference__scope--${scope}`"
                :title="scopeLabelMap[scope]"
                :aria-label="scopeLabelMap[scope]"
              >
                {{ scopeIconMap[scope] }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <p v-if="filteredSections.length === 0" class="wevu-api-reference__empty">
      No API matched "{{ query }}".
    </p>
  </div>
</template>

<style scoped>
/* stylelint-disable-next-line selector-class-pattern */
:global(.Layout.wevu-api-home .VPDoc .content) {
  max-width: 1080px !important;
}

/* stylelint-disable-next-line selector-class-pattern */
:global(.Layout.wevu-api-home .VPDoc .content-container) {
  max-width: 980px !important;
}

.wevu-api-reference__filter {
  margin: 20px 0 28px;
}

.wevu-api-reference__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -12px 0 18px;
}

.wevu-api-reference__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
}

.wevu-api-reference__input {
  width: min(100%, 560px);
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-border);
  border-radius: 10px;
}

.wevu-api-reference__input:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.wevu-api-reference__section {
  margin-top: 28px;
}

.wevu-api-reference__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px 28px;
}

.wevu-api-reference__group h3 {
  margin: 0 0 10px;
}

.wevu-api-reference__group--full {
  grid-column: 1 / -1;
}

.wevu-api-reference__columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.wevu-api-reference__column {
  min-width: 0;
}

.wevu-api-reference__column h4 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--vp-c-text-2);
}

.wevu-api-reference__group ul {
  padding-left: 20px;
  margin: 0;
}

.wevu-api-reference__group li + li {
  margin-top: 6px;
}

.wevu-api-reference__scope {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  margin-left: 6px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  vertical-align: middle;
  color: #0f172a;
  background: #f8fafc;
  border: 1px solid rgb(15 23 42 / 18%);
  border-radius: 999px;
}

.wevu-api-reference__scope--app {
  color: #0f5132;
  background: #dcfce7;
  border-color: #86efac;
}

.wevu-api-reference__scope--page {
  color: #1e40af;
  background: #dbeafe;
  border-color: #93c5fd;
}

.wevu-api-reference__scope--component {
  color: #7c2d12;
  background: #ffedd5;
  border-color: #fdba74;
}

@media (width <= 1100px) {
  .wevu-api-reference__columns {
    grid-template-columns: 1fr;
  }
}

.wevu-api-reference__empty {
  margin-top: 24px;
  color: var(--vp-c-text-2);
}
</style>
