<script setup lang="ts">
import { computed, ref } from 'vue'

const QUERY_SPLIT_RE = /\s+/

interface WeapiNavItem {
  text: string
  href: string
  summary: string
  keywords?: string[]
}

interface WeapiNavSection {
  title: string
  items: WeapiNavItem[]
}

const query = ref('')

const sections: WeapiNavSection[] = [
  {
    title: 'Overview',
    items: [
      {
        text: '@wevu/api',
        href: '/packages/weapi/',
        summary: '入口说明、安装方式、Promise / 回调 / 显式实例的基本心智。',
        keywords: ['wpi', 'weapi', 'api', '跨端', '跨平台', '微信 api', '支付宝 api', '抖音 api'],
      },
      {
        text: '兼容总览',
        href: '/packages/weapi/compat-overview',
        summary: '查看三端覆盖率、对齐结论和整体兼容规模。',
        keywords: ['api', '兼容', '覆盖率', '微信', '支付宝', '抖音', 'platform'],
      },
    ],
  },
  {
    title: 'Catalog',
    items: [
      {
        text: 'API 全量清单',
        href: '/packages/weapi/wx-method-list',
        summary: '按微信命名列出完整 API，并附带简要说明、示例和原始文档搜索链接。',
        keywords: ['api', '微信', 'wx', '微信 api', '全量', '目录', 'search', '搜索'],
      },
      {
        text: '平台独有 API 清单',
        href: '/packages/weapi/platform-only-methods',
        summary: '查看支付宝 / 抖音相对微信命名体系的独有 API。',
        keywords: ['api', '支付宝', '抖音', '独有', '平台', 'my', 'tt'],
      },
    ],
  },
  {
    title: 'Compatibility',
    items: [
      {
        text: '支付宝兼容矩阵',
        href: '/packages/weapi/alipay-compat-matrix',
        summary: '查看每个微信命名 API 在支付宝端的目标方法和支持策略。',
        keywords: ['api', '支付宝', 'alipay', 'my', '微信 api', '兼容', '矩阵'],
      },
      {
        text: '抖音兼容矩阵',
        href: '/packages/weapi/douyin-compat-matrix',
        summary: '查看每个微信命名 API 在抖音端的目标方法和支持策略。',
        keywords: ['api', '抖音', 'douyin', 'tt', '微信 api', '兼容', '矩阵'],
      },
      {
        text: '兼容差异说明',
        href: '/packages/weapi/gap-notes',
        summary: '理解 unsupported、typings 差异和命名例外。',
        keywords: ['api', '差异', '兼容', 'unsupported', 'typings', '微信', '支付宝', '抖音'],
      },
    ],
  },
]

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const filteredSections = computed(() => {
  if (!normalizedQuery.value) {
    return sections
  }

  const tokens = normalizedQuery.value
    .split(QUERY_SPLIT_RE)
    .map(item => item.trim())
    .filter(Boolean)

  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(item =>
        tokens.every((token) => {
          const haystack = [
            section.title,
            item.text,
            item.summary,
            ...(item.keywords ?? []),
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(token)
        }),
      ),
    }))
    .filter(section => section.items.length > 0)
})
</script>

<template>
  <div class="weapi-reference">
    <h1>@wevu/api Docs</h1>
    <p class="weapi-reference__intro">
      这里是 <code>@wevu/api</code> 的独立文档入口。你可以先按主题找到页面，再进入具体矩阵或全量目录。
    </p>

    <div class="weapi-reference__filter">
      <label class="weapi-reference__label" for="weapi-filter">Filter</label>
      <input
        id="weapi-filter"
        v-model="query"
        class="weapi-reference__input"
        type="search"
        placeholder="搜索页面，例如 API / 支付宝 / 微信 API / 差异 / 全量"
      >
    </div>

    <section
      v-for="section in filteredSections"
      :key="section.title"
      class="weapi-reference__section"
    >
      <h2>{{ section.title }}</h2>
      <div class="weapi-reference__grid">
        <a
          v-for="item in section.items"
          :key="item.href"
          class="weapi-reference__card"
          :href="item.href"
        >
          <strong>{{ item.text }}</strong>
          <span>{{ item.summary }}</span>
        </a>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
/* stylelint-disable-next-line selector-class-pattern */
:global(.Layout.weapi-home .VPDoc .content) {
  max-width: 1280px !important;
}

/* stylelint-disable-next-line selector-class-pattern */
:global(.Layout.weapi-home .VPDoc .content-container) {
  max-width: 1180px !important;
}

.weapi-reference {
  display: grid;
  gap: 24px;
}

.weapi-reference__intro {
  margin: 0;
  color: var(--vp-c-text-2);
}

.weapi-reference__filter {
  padding: 16px;
  background: linear-gradient(135deg, rgb(34 197 94 / 10%), rgb(14 165 233 / 10%)), var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
}

.weapi-reference__label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.weapi-reference__input {
  width: 100%;
  padding: 12px 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.weapi-reference__section {
  display: grid;
  gap: 14px;
}

.weapi-reference__section h2 {
  margin: 0;
}

.weapi-reference__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
}

.weapi-reference__card {
  display: grid;
  gap: 8px;
  min-height: 132px;
  padding: 20px;
  color: inherit;
  text-decoration: none;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.weapi-reference__card:hover {
  background: var(--vp-c-bg-elv);
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
}

.weapi-reference__card span {
  line-height: 1.6;
  color: var(--vp-c-text-2);
}
</style>
