<script setup lang="ts">
import { computed, ref } from 'wevu'
import { getFeatureCardsByKind, getFeatureKindLabel, getPluginShowcaseSummary, getScoreTone } from '../../utils/showcase'

type KindFilter = 'all' | 'vue-sfc' | 'native-ts' | 'scss'

const currentKind = ref<KindFilter>('all')
const score = ref(94)

definePageJson({
  navigationBarTitleText: '插件 Vue SFC 能力页',
  usingComponents: {
    'hello-showcase': '/components/hello-component/index',
    'native-meter': '/components/native-meter/index',
  },
})

const filterOptions = [
  { id: 'all' as KindFilter, label: '全部' },
  { id: 'vue-sfc' as KindFilter, label: getFeatureKindLabel('vue-sfc') },
  { id: 'native-ts' as KindFilter, label: getFeatureKindLabel('native-ts') },
  { id: 'scss' as KindFilter, label: getFeatureKindLabel('scss') },
]

const cards = computed(() => getFeatureCardsByKind(currentKind.value))
const summary = computed(() => getPluginShowcaseSummary())
const meterTone = computed(() => getScoreTone(score.value))

function selectKind(kind: KindFilter) {
  currentKind.value = kind
}

function pulseScore() {
  score.value = score.value >= 96 ? 78 : score.value + 6
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

    <hello-showcase
      title="插件页内直接消费 Vue SFC 公开组件"
      :note="summary"
      :entries="cards"
    />

    <view class="panel">
      <text class="panel__title">同页组合原生 TS + SCSS 组件</text>
      <native-meter
        label="Vue SFC 页面中的 Native Meter"
        :tone="meterTone"
        :value="score"
      />
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
</style>
