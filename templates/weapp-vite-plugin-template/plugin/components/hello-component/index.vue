<script setup lang="ts">
import type { PluginFeatureCard } from '../../utils/showcase'
import { computed } from 'wevu'

const props = defineProps<{
  entries?: PluginFeatureCard[]
  note?: string
  title?: string
}>()

defineComponentJson({
  component: true,
  styleIsolation: 'apply-shared',
})

const safeEntries = computed(() => props.entries ?? [])
</script>

<template>
  <view class="showcase-card">
    <view class="showcase-card__head">
      <view>
        <text class="showcase-card__eyebrow">
          plugin public component
        </text>
        <text class="showcase-card__title">
          {{ props.title || '插件公开 Vue SFC 组件' }}
        </text>
      </view>
      <text class="showcase-card__count">
        {{ safeEntries.length }} items
      </text>
    </view>

    <text v-if="props.note" class="showcase-card__note">
      {{ props.note }}
    </text>

    <view class="showcase-card__list">
      <view
        v-for="entry in safeEntries"
        :key="entry.id"
        class="showcase-card__item"
      >
        <view class="showcase-card__item-head">
          <text class="showcase-card__item-title">
            {{ entry.title }}
          </text>
          <text class="showcase-card__badge">
            {{ entry.kindLabel }}
          </text>
        </view>
        <text class="showcase-card__item-summary">
          {{ entry.summary }}
        </text>
        <view class="showcase-card__score-row">
          <text class="showcase-card__score-label">
            完成度
          </text>
          <text class="showcase-card__score-value">
            {{ entry.score }}%
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss">
.showcase-card {
  padding: 28rpx;
  margin-top: 24rpx;
  background: linear-gradient(180deg, #fff 0%, #f6f8fc 100%);
  border-radius: 28rpx;
  box-shadow: 0 14rpx 30rpx rgb(63 78 107 / 10%);

  &__head {
    display: flex;
    gap: 20rpx;
    align-items: flex-start;
    justify-content: space-between;
  }

  &__eyebrow,
  &__count,
  &__score-label {
    font-size: 22rpx;
    color: #6b778d;
  }

  &__eyebrow,
  &__title,
  &__note,
  &__item-summary,
  &__item-title,
  &__score-row {
    display: block;
  }

  &__eyebrow {
    text-transform: uppercase;
    letter-spacing: 2rpx;
  }

  &__title {
    margin-top: 10rpx;
    font-size: 32rpx;
    font-weight: 700;
    line-height: 1.35;
    color: #1c2e4b;
  }

  &__note {
    margin-top: 16rpx;
    font-size: 24rpx;
    line-height: 1.7;
    color: #52627f;
  }

  &__list {
    display: grid;
    gap: 16rpx;
    margin-top: 20rpx;
  }

  &__item {
    padding: 22rpx;
    background: rgb(255 255 255 / 92%);
    border: 2rpx solid #e7edf8;
    border-radius: 22rpx;
  }

  &__item-head,
  &__score-row {
    display: flex;
    gap: 16rpx;
    align-items: center;
    justify-content: space-between;
  }

  &__item-title {
    flex: 1;
    font-size: 28rpx;
    font-weight: 600;
    line-height: 1.45;
    color: #20324d;
  }

  &__badge {
    padding: 8rpx 16rpx;
    font-size: 22rpx;
    color: #fff;
    background: #203d70;
    border-radius: 999rpx;
  }

  &__item-summary {
    margin-top: 12rpx;
    font-size: 24rpx;
    line-height: 1.65;
    color: #5c6d89;
  }

  &__score-row {
    margin-top: 14rpx;
  }

  &__score-value {
    font-size: 24rpx;
    font-weight: 700;
    color: #1e4f8d;
  }
}
</style>
