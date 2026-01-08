<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

defineOptions({
  options: {
    multipleSlots: true,
  },
})

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    kpis?: KpiItem[]
  }>(),
  {
    title: 'Hello WeVU',
    subtitle: '',
    kpis: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:title', value: string): void
  (e: 'update:subtitle', value: string): void
}>()

type KpiTone = 'positive' | 'negative' | 'neutral'

interface KpiItem {
  key?: string
  label: string
  value: string | number
  unit?: string
  delta?: number
  footnote?: string
}

defineComponentJson({
  styleIsolation: 'apply-shared',
})

const localTitle = ref(props.title ?? 'Hello WeVU')
const localSubtitle = ref(props.subtitle ?? '')

watch(
  () => props.title,
  (value) => {
    localTitle.value = value ?? 'Hello WeVU'
  },
)

watch(
  () => props.subtitle,
  (value) => {
    localSubtitle.value = value ?? ''
  },
)

const hasSubtitle = computed(() => !!localSubtitle.value)
const kpiCards = computed(() =>
  (props.kpis ?? []).map((item, index) => ({
    item,
    index,
    tone: resolveTone(item.delta),
    isHot: index === 0,
  })),
)
const hasKpis = computed(() => kpiCards.value.length > 0)

const titleSuffix = '已更新'
const subtitleText = '来自插槽的更新'

function updateTitle(value: string) {
  localTitle.value = value
  emit('update:title', value)
}

function updateSubtitle(value: string) {
  localSubtitle.value = value
  emit('update:subtitle', value)
}

function markTitle() {
  if (!localTitle.value.endsWith(titleSuffix)) {
    updateTitle(`${localTitle.value}${titleSuffix}`)
  }
}

function toggleSubtitle() {
  updateSubtitle(localSubtitle.value ? '' : subtitleText)
}

function resolveTone(delta?: number): KpiTone {
  if (delta === undefined || Number.isNaN(delta)) {
    return 'neutral'
  }
  if (delta > 0) {
    return 'positive'
  }
  if (delta < 0) {
    return 'negative'
  }
  return 'neutral'
}

function formatDelta(delta?: number, unit = '') {
  if (delta === undefined || Number.isNaN(delta)) {
    return '--'
  }
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta}${unit}`
}

function toneBadgeClass(tone: KpiTone) {
  if (tone === 'positive') {
    return 'bg-[#e7f7ee] text-[#1b7a3a]'
  }
  if (tone === 'negative') {
    return 'bg-[#ffe9e9] text-[#b42318]'
  }
  return 'bg-[#edf1f7] text-[#64748b]'
}

function toneDotClass(tone: KpiTone) {
  if (tone === 'positive') {
    return 'bg-[#22c55e]'
  }
  if (tone === 'negative') {
    return 'bg-[#ef4444]'
  }
  return 'bg-[#94a3b8]'
}
</script>

<template>
  <view class="rounded-[24rpx] bg-gradient-to-br from-[#4c6ef5] to-[#7048e8] p-[24rpx]">
    <view class="flex items-start justify-between gap-[16rpx]">
      <view class="flex-1">
        <text class="block text-[40rpx] font-bold text-white">
          {{ localTitle }}
        </text>
        <text v-if="localSubtitle" class="mt-[8rpx] block text-[26rpx] text-white/85">
          {{ localSubtitle }}
        </text>
      </view>
      <slot
        name="badge"
      >
        <view class="rounded-full bg-white/85 px-[16rpx] py-[6rpx]">
          <text class="text-[22rpx] font-semibold text-[#1c1c3c]">
            默认徽标
          </text>
        </view>
      </slot>
    </view>
    <view class="mt-[16rpx]">
      <slot>
        <view class="rounded-[16rpx] bg-white/85 px-[16rpx] py-[8rpx]">
          <text class="text-[22rpx] text-[#1c1c3c]">
            这是默认插槽内容，来自 HelloWorld。
          </text>
        </view>
      </slot>
    </view>
    <view
      v-if="hasKpis"
      class="mt-[20rpx] rounded-[20rpx] bg-white/15 p-[16rpx]"
    >
      <view class="flex items-center justify-between">
        <text class="text-[24rpx] font-semibold text-white">
          核心指标
        </text>
        <text class="text-[20rpx] text-white/75">
          实时反馈
        </text>
      </view>
      <view class="mt-[12rpx] grid grid-cols-2 gap-[12rpx]">
        <view v-for="card in kpiCards" :key="card.item.key ?? card.index">
          <slot
            name="kpi"
            :item="card.item"
            :index="card.index"
            :tone="card.tone"
            :isHot="card.isHot"
          >
            <view class="rounded-[18rpx] bg-white/92 p-[16rpx]">
              <view class="flex items-center justify-between">
                <view class="flex items-center gap-[8rpx]">
                  <view class="h-[8rpx] w-[8rpx] rounded-full" :class="toneDotClass(card.tone)" />
                  <text class="text-[22rpx] text-[#61618a]">
                    {{ card.item.label }}
                  </text>
                </view>
                <view v-if="card.isHot" class="rounded-full bg-[#fff3c2] px-[10rpx] py-[4rpx]">
                  <text class="text-[18rpx] font-semibold text-[#8a5200]">
                    HOT
                  </text>
                </view>
              </view>
              <view class="mt-[10rpx] flex items-end justify-between">
                <view class="flex items-baseline gap-[6rpx]">
                  <text class="text-[32rpx] font-bold text-[#1c1c3c]">
                    {{ card.item.value }}
                  </text>
                  <text v-if="card.item.unit" class="text-[20rpx] text-[#7a7aa0]">
                    {{ card.item.unit }}
                  </text>
                </view>
                <view class="rounded-full px-[10rpx] py-[4rpx]" :class="toneBadgeClass(card.tone)">
                  <text class="text-[20rpx] font-semibold">
                    {{ card.tone === 'positive' ? '↑' : card.tone === 'negative' ? '↓' : '→' }}
                    {{ formatDelta(card.item.delta, card.item.unit ?? '') }}
                  </text>
                </view>
              </view>
              <text
                v-if="card.item.footnote"
                class="mt-[6rpx] block text-[20rpx] text-[#8a8aa5]"
              >
                {{ card.item.footnote }}
              </text>
            </view>
          </slot>
        </view>
      </view>
    </view>
    <view class="mt-[16rpx] flex flex-wrap gap-[12rpx]">
      <t-button class="!w-20" size="small" theme="default" variant="outline" shape="round" @tap="markTitle">
        更新标题
      </t-button>
      <t-button class="!w-20" size="small" theme="default" variant="outline" shape="round" @tap="toggleSubtitle">
        {{ hasSubtitle ? '清空副标题' : '添加副标题' }}
      </t-button>
    </view>
  </view>
</template>
