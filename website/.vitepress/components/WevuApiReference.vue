<script setup lang="ts">
import { computed, ref } from 'vue'

interface ApiItem {
  text: string
  href: string
}

interface ApiGroup {
  title: string
  items: ApiItem[]
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
          { text: 'createApp()', href: '/wevu/api/core#entry-and-component' },
          { text: 'defineComponent()', href: '/wevu/api/core#entry-and-component' },
          { text: 'createWevuComponent()', href: '/wevu/api/core#entry-and-component' },
          { text: 'registerApp()', href: '/wevu/api/core#entry-and-component' },
          { text: 'registerComponent()', href: '/wevu/api/core#entry-and-component' },
        ],
      },
      {
        title: '<script setup> Macros',
        items: [
          { text: 'defineProps()', href: '/wevu/api/core#script-setup-macros' },
          { text: 'withDefaults()', href: '/wevu/api/core#script-setup-macros' },
          { text: 'defineEmits()', href: '/wevu/api/core#script-setup-macros' },
          { text: 'defineSlots()', href: '/wevu/api/core#script-setup-macros' },
          { text: 'defineExpose()', href: '/wevu/api/core#script-setup-macros' },
          { text: 'defineModel()', href: '/wevu/api/core#script-setup-macros' },
          { text: 'defineOptions()', href: '/wevu/api/core#script-setup-macros' },
          { text: 'useModel()', href: '/wevu/api/core#script-setup-macros' },
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
          { text: 'ref()', href: '/wevu/api/reactivity#state-creation' },
          { text: 'reactive()', href: '/wevu/api/reactivity#state-creation' },
          { text: 'readonly()', href: '/wevu/api/reactivity#state-creation' },
          { text: 'computed()', href: '/wevu/api/reactivity#state-creation' },
        ],
      },
      {
        title: 'Reactivity: Watch & Scheduler',
        items: [
          { text: 'watch()', href: '/wevu/api/reactivity#watch-effects' },
          { text: 'watchEffect()', href: '/wevu/api/reactivity#watch-effects' },
          { text: 'watchPostEffect()', href: '/wevu/api/reactivity#watch-effects' },
          { text: 'watchSyncEffect()', href: '/wevu/api/reactivity#watch-effects' },
          { text: 'nextTick()', href: '/wevu/api/reactivity#scheduling' },
        ],
      },
      {
        title: 'Setup Context',
        items: [
          { text: 'setup(props, ctx)', href: '/wevu/api/setup-context#setup-signature' },
          { text: 'ctx.emit()', href: '/wevu/api/setup-context#setup-context-api' },
          { text: 'getCurrentInstance()', href: '/wevu/api/setup-context#setup-context-api' },
          { text: 'provide()/inject()', href: '/wevu/api/setup-context#provide-inject' },
          { text: 'ctx.bindModel()', href: '/wevu/api/setup-context#bind-model' },
        ],
      },
      {
        title: 'Lifecycle',
        items: [
          { text: 'onLaunch()/onAppShow()/onAppHide()', href: '/wevu/api/lifecycle#app-lifecycle' },
          { text: 'onLoad()/onShow()/onReady()/onHide()/onUnload()', href: '/wevu/api/lifecycle#common-lifecycle' },
          { text: 'onPullDownRefresh()/onReachBottom()/onPageScroll()', href: '/wevu/api/lifecycle#page-events' },
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
          { text: 'defineStore()', href: '/wevu/api/store#store-core' },
          { text: 'createStore()', href: '/wevu/api/store#store-core' },
          { text: 'storeToRefs()', href: '/wevu/api/store#store-core' },
        ],
      },
      {
        title: 'Runtime Bridge',
        items: [
          { text: 'registerRuntime()', href: '/wevu/api/runtime-bridge#registration-mount' },
          { text: 'setWevuDefaults()', href: '/wevu/api/runtime-bridge#defaults-switches' },
          { text: 'createMutationRecord()/toRawSnapshot()', href: '/wevu/api/runtime-bridge#debug-observe' },
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
          { text: '高频类型速查', href: '/wevu/api/types#quick-reference' },
          { text: 'Interfaces 全量索引', href: '/wevu/api/types#interfaces-index' },
          { text: 'Type Aliases 全量索引', href: '/wevu/api/types#aliases-index' },
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
        .map(group => ({
          ...group,
          items: group.items.filter(item =>
            item.text.toLowerCase().includes(normalizedQuery.value)
            || group.title.toLowerCase().includes(normalizedQuery.value)
            || section.title.toLowerCase().includes(normalizedQuery.value),
          ),
        }))
        .filter(group => group.items.length > 0),
    }))
    .filter(section => section.groups.length > 0)
})
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
        >
          <h3>{{ group.title }}</h3>
          <ul>
            <li v-for="item in group.items" :key="item.href">
              <a :href="item.href">{{ item.text }}</a>
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
.wevu-api-reference__filter {
  margin: 20px 0 28px;
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

.wevu-api-reference__group ul {
  padding-left: 20px;
  margin: 0;
}

.wevu-api-reference__group li + li {
  margin-top: 6px;
}

.wevu-api-reference__empty {
  margin-top: 24px;
  color: var(--vp-c-text-2);
}
</style>
