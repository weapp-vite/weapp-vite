<script setup lang="ts">
import { computed, ref } from 'vue'
import { generateMethodCompatibilityMatrix } from '../../../packages-runtime/weapi/src/core/methodMapping'
import { WEAPI_METHOD_SUPPORT_MATRIX } from '../../../packages-runtime/weapi/src/core/methodMapping/supportMatrix'
import { matchWeapiCapability, WEAPI_CAPABILITY_GROUPS } from '../shared/weapiCapabilities'

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
  capability?: string
  basePath?: string
  platform: 'alipay' | 'douyin'
  searchable?: boolean
}>(), {
  capability: '',
  basePath: '',
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
    .filter(item => matchWeapiCapability(item.method, props.capability))
})

const activeCapability = computed(() => {
  return WEAPI_CAPABILITY_GROUPS.find(item => item.key === props.capability) ?? WEAPI_CAPABILITY_GROUPS[0]
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
      <div class="weapi-compat__caps">
        <a
          v-for="group in WEAPI_CAPABILITY_GROUPS"
          :key="group.key"
          class="weapi-compat__cap"
          :class="{ 'is-active': activeCapability.key === group.key }"
          :href="`${props.basePath}/${group.key}`"
        >
          {{ group.label }}
        </a>
      </div>
      <input
        v-model="keyword"
        class="weapi-compat__search"
        type="search"
        placeholder="搜索 API 名称、目标方法或策略"
      >
      <p class="weapi-compat__meta">
        共 {{ rows.length }} / {{ allRows.length }} 个当前能力域 API
      </p>
    </div>

    <h2 :id="activeCapability.key" class="weapi-compat__title">
      {{ activeCapability.label }}
    </h2>

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
  gap: 12px;
}

.weapi-compat__toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 10px;
  background: linear-gradient(135deg, rgb(250 204 21 / 10%), rgb(59 130 246 / 10%)), var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.weapi-compat__search {
  width: 100%;
  padding: 8px 10px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
}

.weapi-compat__caps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.weapi-compat__cap {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.2;
  cursor: pointer;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
}

.weapi-compat__cap.is-active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
}

.weapi-compat__meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.weapi-compat__title {
  margin: 0;
  font-size: 18px;
}

.weapi-compat__card {
  padding: 12px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
}

.weapi-compat__header {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}

.weapi-compat__header h2 {
  margin: 0;
  font-size: 17px;
}

.weapi-compat__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 68px;
  padding: 2px 8px;
  font-size: 11px;
  background: var(--vp-c-default-soft);
  border-radius: 999px;
}

.weapi-compat__desc {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--vp-c-text-1);
}

.weapi-compat__links {
  margin-top: 6px;
  font-size: 13px;
}

.weapi-compat__section {
  margin-top: 12px;
}

.weapi-compat__section h3 {
  margin-bottom: 6px;
  font-size: 14px;
}

.weapi-compat__section ul {
  padding-left: 16px;
  margin: 0;
  font-size: 14px;
}
</style>
