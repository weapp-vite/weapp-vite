<script setup lang="ts">
import { computed, ref, watch } from 'wevu'

const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
  }>(),
  {
    title: 'Hello WeVU',
    subtitle: '',
  },
)

const emit = defineEmits<{
  (e: 'update:title', value: string): void
  (e: 'update:subtitle', value: string): void
}>()

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

const titleSuffix = ' · 已更新'
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
