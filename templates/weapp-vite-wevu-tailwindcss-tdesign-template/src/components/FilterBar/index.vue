<script setup lang="ts">
import { computed } from 'wevu'

const props = withDefaults(
  defineProps<{
    query: string
    active: string
    filters: FilterItem[]
  }>(),
  {
    query: '',
    active: 'all',
    filters: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'update:active', value: string): void
}>()

defineComponentJson({
  styleIsolation: 'apply-shared',
})

interface FilterItem {
  value: string
  label: string
  count?: number
}

const filterItems = computed(() => props.filters ?? [])

function onQueryChange(e: WechatMiniprogram.CustomEvent<{ value: string }>) {
  emit('update:query', e.detail.value)
}

function onSelect(value: string) {
  emit('update:active', value)
}
</script>

<template>
  <view class="rounded-[20rpx] bg-white p-[16rpx] shadow-[0_12rpx_28rpx_rgba(17,24,39,0.08)]">
    <t-search
      placeholder="搜索标题或负责人"
      :value="query"
      clearable
      @change="onQueryChange"
    />
    <view class="mt-[12rpx] flex flex-wrap gap-[12rpx]">
      <t-check-tag
        v-for="item in filterItems"
        :key="item.value"
        :checked="item.value === active"
        @change="onSelect(item.value)"
      >
        {{ item.label }}
        <text v-if="item.count !== undefined">
          ({{ item.count }})
        </text>
      </t-check-tag>
    </view>
  </view>
</template>
