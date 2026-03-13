<script setup lang="ts">
import { computed, ref } from 'vue'
import { WEAPI_METHOD_SUPPORT_MATRIX } from '../../../packages/weapi/src/core/methodMapping/supportMatrix'
import { matchWeapiDocGroup } from '../shared/weapiGroups'

interface WeapiCatalogItem {
  method: string
  description: string
  wxStrategy: string
  alipayStrategy: string
  douyinStrategy: string
  support: string
}

const props = withDefaults(defineProps<{
  group?: string
  searchable?: boolean
}>(), {
  group: '',
  searchable: true,
})

const keyword = ref('')

function createExample(method: string) {
  if (method.startsWith('on')) {
    return `import { wpi } from '@wevu/api'

wpi.${method}((payload) => {
  console.log(payload)
})`
  }

  if (method.startsWith('off')) {
    return `import { wpi } from '@wevu/api'

const handler = () => {}
wpi.${method}(handler)`
  }

  if (method.endsWith('Sync')) {
    return `import { wpi } from '@wevu/api'

const result = wpi.${method}()`
  }

  return `import { wpi } from '@wevu/api'

const result = await wpi.${method}({
  // ...
})`
}

function createOfficialLink(method: string) {
  return `https://developers.weixin.qq.com/miniprogram/dev/api/?search-key=${encodeURIComponent(method)}`
}

const baseRows = computed(() => {
  const source = WEAPI_METHOD_SUPPORT_MATRIX as readonly WeapiCatalogItem[]
  return source.filter(item => matchWeapiDocGroup(item.method, props.group))
})

const rows = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()
  if (!normalized) {
    return baseRows.value
  }

  return baseRows.value.filter((item) => {
    return item.method.toLowerCase().includes(normalized)
      || item.description.toLowerCase().includes(normalized)
  })
})
</script>

<template>
  <div class="weapi-catalog">
    <div v-if="props.searchable" class="weapi-catalog__toolbar">
      <input
        v-model="keyword"
        class="weapi-catalog__search"
        type="search"
        placeholder="搜索 API 名称或说明，例如 showToast / 登录 / 蓝牙"
      >
      <p class="weapi-catalog__meta">
        共 {{ rows.length }} / {{ baseRows.length }} 个当前分组 API
      </p>
    </div>

    <div
      v-for="item in rows"
      :key="item.method"
      class="weapi-catalog__card"
    >
      <div class="weapi-catalog__header">
        <h2 :id="item.method">
          <code>{{ item.method }}</code>
        </h2>
        <span class="weapi-catalog__badge">
          {{ item.support }}
        </span>
      </div>

      <p class="weapi-catalog__desc">
        {{ item.description }}
      </p>

      <div class="weapi-catalog__links">
        <a
          :href="createOfficialLink(item.method)"
          target="_blank"
          rel="noreferrer"
        >
          微信开放文档搜索
        </a>
      </div>

      <div class="weapi-catalog__section">
        <h3>大概用法</h3>
        <pre><code>{{ createExample(item.method) }}</code></pre>
      </div>

      <div class="weapi-catalog__section">
        <h3>三端策略</h3>
        <ul>
          <li><strong>微信：</strong>{{ item.wxStrategy }}</li>
          <li><strong>支付宝：</strong>{{ item.alipayStrategy }}</li>
          <li><strong>抖音：</strong>{{ item.douyinStrategy }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.weapi-catalog {
  display: grid;
  gap: 20px;
}

.weapi-catalog__toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 16px;
  background: linear-gradient(135deg, rgb(149 236 105 / 12%), rgb(14 165 233 / 10%)), var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.weapi-catalog__search {
  width: 100%;
  padding: 12px 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.weapi-catalog__meta {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.weapi-catalog__card {
  padding: 20px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
}

.weapi-catalog__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.weapi-catalog__header h2 {
  margin: 0;
}

.weapi-catalog__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--vp-c-default-soft);
  border-radius: 999px;
}

.weapi-catalog__desc {
  margin: 12px 0 0;
  color: var(--vp-c-text-1);
}

.weapi-catalog__links {
  margin-top: 10px;
}

.weapi-catalog__section {
  margin-top: 18px;
}

.weapi-catalog__section h3 {
  margin-bottom: 10px;
}

.weapi-catalog__section pre {
  padding: 14px;
  overflow: auto;
  background: var(--vp-code-block-bg);
  border-radius: 14px;
}

.weapi-catalog__section ul {
  padding-left: 18px;
}
</style>
