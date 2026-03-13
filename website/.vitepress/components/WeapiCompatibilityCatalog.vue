<script setup lang="ts">
import { computed, ref } from 'vue'
import { generateMethodCompatibilityMatrix } from '../../../packages/weapi/src/core/methodMapping'
import { WEAPI_METHOD_SUPPORT_MATRIX } from '../../../packages/weapi/src/core/methodMapping/supportMatrix'
import { matchWeapiDocGroup } from '../shared/weapiGroups'

interface CompatibilityItem {
  method: string
  wxStrategy: string
  alipayTarget: string
  alipayStrategy: string
  alipaySupported: boolean
  alipaySupportLevel: string
  alipaySemanticallyAligned: boolean
  douyinTarget: string
  douyinStrategy: string
  douyinSupported: boolean
  douyinSupportLevel: string
  douyinSemanticallyAligned: boolean
}

interface MethodMeta {
  method: string
  description: string
}

const props = withDefaults(defineProps<{
  group?: string
  platform: 'alipay' | 'douyin'
  searchable?: boolean
}>(), {
  group: '',
  searchable: true,
})

const keyword = ref('')

const descriptionMap = new Map(
  (WEAPI_METHOD_SUPPORT_MATRIX as readonly MethodMeta[]).map(item => [item.method, item.description]),
)

function createOfficialLink(method: string) {
  return `https://developers.weixin.qq.com/miniprogram/dev/api/?search-key=${encodeURIComponent(method)}`
}

const allRows = computed(() => {
  return (generateMethodCompatibilityMatrix() as readonly CompatibilityItem[])
    .filter(item => matchWeapiDocGroup(item.method, props.group))
})

const rows = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()
  if (!normalized) {
    return allRows.value
  }

  return allRows.value.filter((item) => {
    const platformTarget = props.platform === 'alipay' ? item.alipayTarget : item.douyinTarget
    const strategy = props.platform === 'alipay' ? item.alipayStrategy : item.douyinStrategy
    const description = descriptionMap.get(item.method) ?? ''
    return `${item.method} ${platformTarget} ${strategy} ${description}`.toLowerCase().includes(normalized)
  })
})
</script>

<template>
  <div class="weapi-compat">
    <div v-if="props.searchable" class="weapi-compat__toolbar">
      <input
        v-model="keyword"
        class="weapi-compat__search"
        type="search"
        placeholder="搜索 API 名称、目标方法或策略"
      >
      <p class="weapi-compat__meta">
        共 {{ rows.length }} / {{ allRows.length }} 个当前分组 API
      </p>
    </div>

    <div
      v-for="item in rows"
      :key="item.method"
      class="weapi-compat__card"
    >
      <div class="weapi-compat__header">
        <h2 :id="item.method">
          <code>{{ item.method }}</code>
        </h2>
        <span class="weapi-compat__badge">
          {{ props.platform === 'alipay' ? item.alipaySupportLevel : item.douyinSupportLevel }}
        </span>
      </div>

      <p class="weapi-compat__desc">
        {{ descriptionMap.get(item.method) }}
      </p>

      <div class="weapi-compat__links">
        <a
          :href="createOfficialLink(item.method)"
          target="_blank"
          rel="noreferrer"
        >
          微信开放文档搜索
        </a>
      </div>

      <div class="weapi-compat__section">
        <h3>{{ props.platform === 'alipay' ? '支付宝' : '抖音' }}目标方法</h3>
        <p>
          <code>{{ props.platform === 'alipay' ? item.alipayTarget : item.douyinTarget }}</code>
        </p>
      </div>

      <div class="weapi-compat__section">
        <h3>策略说明</h3>
        <ul>
          <li><strong>微信：</strong>{{ item.wxStrategy }}</li>
          <li v-if="props.platform === 'alipay'">
            <strong>支付宝：</strong>{{ item.alipayStrategy }}
          </li>
          <li v-else>
            <strong>抖音：</strong>{{ item.douyinStrategy }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.weapi-compat {
  display: grid;
  gap: 20px;
}

.weapi-compat__toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 16px;
  background: linear-gradient(135deg, rgb(250 204 21 / 10%), rgb(59 130 246 / 10%)), var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
}

.weapi-compat__search {
  width: 100%;
  padding: 12px 14px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.weapi-compat__meta {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.weapi-compat__card {
  padding: 20px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 18px;
}

.weapi-compat__header {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.weapi-compat__header h2 {
  margin: 0;
}

.weapi-compat__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 84px;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--vp-c-default-soft);
  border-radius: 999px;
}

.weapi-compat__desc {
  margin: 12px 0 0;
  color: var(--vp-c-text-1);
}

.weapi-compat__links {
  margin-top: 10px;
}

.weapi-compat__section {
  margin-top: 18px;
}

.weapi-compat__section h3 {
  margin-bottom: 10px;
}

.weapi-compat__section ul {
  padding-left: 18px;
}
</style>
