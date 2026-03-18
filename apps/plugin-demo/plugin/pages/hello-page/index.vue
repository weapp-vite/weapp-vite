<script setup lang="ts">
import { ref } from 'wevu'
import { getFeatureCardsByKind, getFeatureKindLabel, getPluginShowcaseSummary, getScoreTone } from '../../utils/showcase'

type KindFilter = 'all' | 'vue-sfc' | 'native-ts' | 'scss'

const currentKind = ref<KindFilter>('all')
const score = ref(94)
const cards = ref(getFeatureCardsByKind('all'))
const summary = getPluginShowcaseSummary()
const meterTone = ref(getScoreTone(score.value))

definePageJson({
  navigationBarTitleText: '插件 Vue SFC 能力页',
})

const filterOptions = [
  { id: 'all' as KindFilter, label: '全部' },
  { id: 'vue-sfc' as KindFilter, label: getFeatureKindLabel('vue-sfc') },
  { id: 'native-ts' as KindFilter, label: getFeatureKindLabel('native-ts') },
  { id: 'scss' as KindFilter, label: getFeatureKindLabel('scss') },
]

function selectKind(kind: KindFilter) {
  currentKind.value = kind
  cards.value = getFeatureCardsByKind(kind)
}

function pulseScore() {
  score.value = score.value >= 96 ? 78 : score.value + 6
  meterTone.value = getScoreTone(score.value)
}
</script>

<template>
  <view class="page">
    <view class="hero">
      <text class="hero__eyebrow">plugin vue sfc</text>
      <text class="hero__title">插件页直接使用 Vue SFC</text>
      <text class="hero__desc">
        当前页面由 `.vue` 入口产出，同时组合插件内的原生 TS 组件与公开 Vue SFC 组件。
      </text>
    </view>

    <view class="toolbar">
      <view
        v-for="option in filterOptions"
        :key="option.id"
        class="toolbar__chip"
        :class="currentKind === option.id ? 'toolbar__chip--active' : ''"
        @tap="selectKind(option.id)"
      >
        <text>{{ option.label }}</text>
      </view>
    </view>

    <view class="overview">
      <text class="overview__title">插件 Vue 页内的数据渲染</text>
      <text class="overview__summary">{{ summary }}</text>

      <view
        v-for="card in cards"
        :key="card.id"
        class="overview__item"
      >
        <view class="overview__item-head">
          <text class="overview__item-title">{{ card.title }}</text>
          <text class="overview__badge">{{ card.kindLabel }}</text>
        </view>
        <text class="overview__item-summary">{{ card.summary }}</text>
        <text class="overview__item-score">完成度 {{ card.score }}%</text>
      </view>
    </view>

    <view class="panel">
      <text class="panel__title">当前页内的响应式评分条</text>
      <view class="meter">
        <view class="meter__head">
          <text class="meter__label">Vue SFC Page Score</text>
          <text class="meter__value">{{ score }}%</text>
        </view>
        <view class="meter__track">
          <view
            class="meter__bar"
            :class="`meter__bar--${meterTone}`"
            :style="`width: ${score}%`"
          />
        </view>
      </view>
      <button class="panel__button" @tap="pulseScore">
        切换页面内评分
      </button>
    </view>
  </view>
</template>

<style lang="scss">
page {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgb(82 188 255 / 20%), transparent 28%),
    linear-gradient(180deg, #eff5ff 0%, #f7fbff 100%);
}

.page {
  padding: 28rpx 24rpx 40rpx;
}

.hero,
.panel {
  border-radius: 28rpx;
}

.hero {
  padding: 34rpx 32rpx;
  background: linear-gradient(135deg, #16315c 0%, #25549c 54%, #34a0a4 100%);
  color: #fff;
  box-shadow: 0 18rpx 42rpx rgb(31 71 130 / 18%);

  &__eyebrow,
  &__title,
  &__desc {
    display: block;
  }

  &__eyebrow {
    font-size: 22rpx;
    letter-spacing: 4rpx;
    text-transform: uppercase;
    opacity: 0.74;
  }

  &__title {
    margin-top: 12rpx;
    font-size: 40rpx;
    font-weight: 700;
  }

  &__desc {
    margin-top: 16rpx;
    font-size: 25rpx;
    line-height: 1.75;
    opacity: 0.92;
  }
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 22rpx;

  &__chip {
    padding: 14rpx 20rpx;
    border-radius: 999rpx;
    background: rgb(255 255 255 / 85%);
    color: #35527f;
    font-size: 24rpx;
    box-shadow: 0 8rpx 18rpx rgb(70 103 157 / 8%);
  }

  &__chip--active {
    background: #214781;
    color: #fff;
  }
}

.panel {
  margin-top: 24rpx;
  padding: 28rpx;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 14rpx 28rpx rgb(74 103 146 / 10%);

  &__title {
    display: block;
    margin-bottom: 12rpx;
    font-size: 30rpx;
    font-weight: 600;
    color: #17335a;
  }

  &__button {
    margin-top: 18rpx;
    border-radius: 999rpx;
    background: #1d4f91;
    color: #fff;
    font-size: 26rpx;
  }
}

.overview {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: 28rpx;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 12rpx 28rpx rgb(69 96 137 / 10%);

  &__title,
  &__summary,
  &__item-title,
  &__item-summary,
  &__item-score {
    display: block;
  }

  &__title {
    font-size: 30rpx;
    font-weight: 600;
    color: #18355f;
  }

  &__summary {
    margin-top: 12rpx;
    font-size: 24rpx;
    line-height: 1.7;
    color: #566883;
  }

  &__item {
    margin-top: 18rpx;
    padding: 22rpx;
    border: 2rpx solid #e6edf9;
    border-radius: 22rpx;
    background: #fff;
  }

  &__item-head {
    display: flex;
    justify-content: space-between;
    gap: 16rpx;
    align-items: center;
  }

  &__item-title {
    flex: 1;
    font-size: 28rpx;
    font-weight: 600;
    color: #1f314c;
  }

  &__badge {
    padding: 8rpx 16rpx;
    border-radius: 999rpx;
    background: #244b87;
    color: #fff;
    font-size: 22rpx;
  }

  &__item-summary {
    margin-top: 12rpx;
    font-size: 24rpx;
    line-height: 1.65;
    color: #5c6d89;
  }

  &__item-score {
    margin-top: 12rpx;
    font-size: 23rpx;
    color: #23508d;
    font-weight: 600;
  }
}

.meter {
  margin-top: 10rpx;

  &__head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16rpx;
  }

  &__label,
  &__value {
    font-size: 24rpx;
    color: #21416e;
  }

  &__value {
    font-weight: 700;
  }

  &__track {
    height: 16rpx;
    margin-top: 16rpx;
    overflow: hidden;
    background: #dce8fb;
    border-radius: 999rpx;
  }

  &__bar {
    height: 100%;
    border-radius: 999rpx;
    transition: width 0.25s ease;
  }

  &__bar--neutral {
    background: linear-gradient(90deg, #5f7cff, #4d63dd);
  }

  &__bar--success {
    background: linear-gradient(90deg, #0d9488, #22c55e);
  }

  &__bar--danger {
    background: linear-gradient(90deg, #dc2626, #f97316);
  }
}
</style>
