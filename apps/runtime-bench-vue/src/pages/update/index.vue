<script lang="ts">
import type { SetDataDebugInfo } from 'wevu'
import type { BenchMetrics, BenchSetDataDiagnosticsSummary, SetDataCounter } from '../../utils/bench'
import { defineComponent, nextTick, onLoad, onReady } from 'wevu'
import {
  createBenchCards,
  createEmptyMetrics,
  createSetDataDiagnosticsTracker,
  mutateBenchCards,
  now,
  patchSetData,
  recordSetDataDebugEvent,
  recordSetDataFlushEvent,
  resetSetDataDiagnosticsTracker,
  summarizeBenchCards,
  summarizeSetDataDiagnostics,
  UPDATE_CARD_COUNT,
} from '../../utils/bench'

const setDataCounter: SetDataCounter = {
  total: 0,
  firstCommitAt: null,
}
const setDataDiagnosticsTracker = createSetDataDiagnosticsTracker()

let loadStartedAt = 0

function createEmptyDiagnosticsSummary(): BenchSetDataDiagnosticsSummary {
  return {
    flushes: 0,
    patchFlushes: 0,
    diffFlushes: 0,
    fallbackFlushes: 0,
    fallbackReasons: {},
    avgPayloadKeys: 0,
    maxPayloadKeys: 0,
    avgPendingPatchKeys: 0,
    maxPendingPatchKeys: 0,
    avgBytes: 0,
    maxBytes: 0,
    avgComputedDirtyKeys: 0,
    maxComputedDirtyKeys: 0,
    avgMergedSiblingParents: 0,
    maxMergedSiblingParents: 0,
  }
}

function recordSetDataDebug(info: SetDataDebugInfo) {
  recordSetDataDebugEvent(setDataDiagnosticsTracker, info)
}

function resetSetDataDiagnostics() {
  resetSetDataDiagnosticsTracker(setDataDiagnosticsTracker)
}

function buildSnapshot(data: {
  cards: unknown[]
  metrics: BenchMetrics
  readyMarker: string
  summary: string
}) {
  return {
    readyMarker: data.readyMarker,
    cardCount: data.cards.length,
    summary: data.summary,
    metrics: data.metrics,
    totalSetDataCalls: setDataCounter.total,
  }
}

function buildUpdateSnapshot(data: {
  cards: unknown[]
  metrics: BenchMetrics
  readyMarker: string
  summary: string
  setDataDiagnostics: {
    singleCommit: BenchSetDataDiagnosticsSummary
    microCommit: BenchSetDataDiagnosticsSummary
  }
}) {
  return {
    readyMarker: data.readyMarker,
    cardCount: data.cards.length,
    summary: data.summary,
    metrics: data.metrics,
    totalSetDataCalls: setDataCounter.total,
    setDataDiagnostics: data.setDataDiagnostics,
  }
}

export default defineComponent({
  setData: {
    debugWhen: 'always',
    debug: recordSetDataDebug,
  },
  setup(_props, ctx) {
    const state = ctx.state as any
    const instance = ctx.instance as any
    patchSetData(instance, setDataCounter, () => {
      recordSetDataFlushEvent(setDataDiagnosticsTracker)
    })

    onLoad(() => {
      loadStartedAt = now()
      setDataCounter.total = 0
      setDataCounter.firstCommitAt = null
      resetSetDataDiagnostics()
      patchSetData(instance, setDataCounter, () => {
        recordSetDataFlushEvent(setDataDiagnosticsTracker)
      })

      const cards = createBenchCards(11, UPDATE_CARD_COUNT)
      state.readyMarker = 'vue-update-ready'
      state.summary = summarizeBenchCards(cards)
      state.cards = cards
      state.metrics = createEmptyMetrics()
      state.totalSetDataCalls = 0
      state.setDataDiagnostics = {
        singleCommit: createEmptyDiagnosticsSummary(),
        microCommit: createEmptyDiagnosticsSummary(),
      }
    })

    onReady(() => {
      state.metrics = {
        ...state.metrics,
        loadToReadyMs: now() - loadStartedAt,
        firstCommitMs: setDataCounter.firstCommitAt ? setDataCounter.firstCommitAt - loadStartedAt : 0,
      }
      state.totalSetDataCalls = setDataCounter.total
    })

    async function readBenchState() {
      state.totalSetDataCalls = setDataCounter.total
      return buildSnapshot(state)
    }

    async function runSingleCommitBench(rounds = 180) {
      resetSetDataDiagnostics()
      const startCalls = setDataCounter.total
      const startAt = now()
      let cards = state.cards
      const computeStartedAt = now()

      for (let index = 0; index < rounds; index += 1) {
        cards = mutateBenchCards(cards, index + 1)
      }
      const computeMs = now() - computeStartedAt

      const dispatchStartedAt = now()
      state.cards = cards
      state.summary = summarizeBenchCards(cards)
      const dispatchMs = now() - dispatchStartedAt

      const flushStartedAt = now()
      await nextTick()
      const flushMs = now() - flushStartedAt
      const commitMs = dispatchMs + flushMs

      state.metrics = {
        ...state.metrics,
        singleCommitMs: now() - startAt,
        singleCommitComputeMs: computeMs,
        singleCommitCommitMs: commitMs,
        singleCommitDispatchMs: dispatchMs,
        singleCommitFlushMs: flushMs,
        singleCommitSetDataCalls: setDataCounter.total - startCalls,
      }
      state.totalSetDataCalls = setDataCounter.total
      state.setDataDiagnostics = {
        ...state.setDataDiagnostics,
        singleCommit: summarizeSetDataDiagnostics(setDataDiagnosticsTracker),
      }

      return buildUpdateSnapshot(state)
    }

    async function runMicroCommitBench(rounds = 40) {
      resetSetDataDiagnostics()
      const startCalls = setDataCounter.total
      const startAt = now()
      let cards = state.cards
      let computeMs = 0
      let commitMs = 0
      let dispatchMs = 0
      let flushMs = 0

      for (let index = 0; index < rounds; index += 1) {
        const computeStartedAt = now()
        cards = mutateBenchCards(cards, index + 1)
        computeMs += now() - computeStartedAt

        const dispatchStartedAt = now()
        state.cards = cards
        state.summary = summarizeBenchCards(cards)
        dispatchMs += now() - dispatchStartedAt

        const flushStartedAt = now()
        await nextTick()
        flushMs += now() - flushStartedAt
      }
      commitMs = dispatchMs + flushMs

      state.metrics = {
        ...state.metrics,
        microCommitMs: now() - startAt,
        microCommitComputeMs: computeMs,
        microCommitCommitMs: commitMs,
        microCommitDispatchMs: dispatchMs,
        microCommitFlushMs: flushMs,
        microCommitSetDataCalls: setDataCounter.total - startCalls,
      }
      state.totalSetDataCalls = setDataCounter.total
      state.setDataDiagnostics = {
        ...state.setDataDiagnostics,
        microCommit: summarizeSetDataDiagnostics(setDataDiagnosticsTracker),
      }

      return buildUpdateSnapshot(state)
    }

    return {
      readBenchState,
      runSingleCommitBench,
      runMicroCommitBench,
    }
  },
  data: () => ({
    title: 'Vue Update Benchmark',
    readyMarker: '',
    summary: '',
    cards: [] as any[],
    metrics: createEmptyMetrics(),
    totalSetDataCalls: 0,
    setDataDiagnostics: {
      singleCommit: createEmptyDiagnosticsSummary(),
      microCommit: createEmptyDiagnosticsSummary(),
    },
  }),
})
</script>

<template>
  <view class="page">
    <view id="bench-ready-marker" class="hero">
      <view class="hero__title">
        {{ title }}
      </view>
      <view class="hero__summary">
        {{ summary }}
      </view>
      <view class="hero__metric">
        single commit: {{ metrics.singleCommitMs }}ms / {{ metrics.singleCommitSetDataCalls }} calls
      </view>
      <view class="hero__metric">
        micro commit: {{ metrics.microCommitMs }}ms / {{ metrics.microCommitSetDataCalls }} calls
      </view>
      <view class="hero__metric">
        setData calls: {{ totalSetDataCalls }}
      </view>
    </view>

    <view class="toolbar">
      <button class="toolbar__btn" size="mini" type="primary" @tap="runSingleCommitBench">
        单次提交
      </button>
      <button class="toolbar__btn" size="mini" @tap="runMicroCommitBench">
        多次提交
      </button>
    </view>

    <view v-for="card in cards" :key="card.id" class="card">
      <view class="card__row">
        <text class="card__title">{{ card.title }}</text>
        <text class="card__badge" :class="{ 'card__badge--active': card.active }">
          {{ card.active ? 'active' : 'idle' }}
        </text>
      </view>
      <view class="card__meta">
        <text>score {{ card.score }}</text>
        <text>delta {{ card.delta }}</text>
      </view>
      <view class="card__summary">
        {{ card.summary }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 24rpx;
}

.hero,
.card {
  background: #fff;
  border-radius: 24rpx;
  box-shadow: 0 12rpx 30rpx rgb(15 23 42 / 6%);
}

.hero {
  padding: 28rpx;
}

.hero__title {
  font-size: 36rpx;
  font-weight: 700;
}

.hero__summary,
.hero__metric,
.card__meta,
.card__summary {
  margin-top: 10rpx;
  color: #475569;
}

.toolbar {
  display: flex;
  gap: 16rpx;
  margin: 20rpx 0;
}

.toolbar__btn {
  flex: 1;
}

.card {
  padding: 22rpx;
  margin-top: 12rpx;
}

.card__row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
}

.card__title {
  font-size: 30rpx;
  font-weight: 600;
}

.card__badge {
  padding: 4rpx 14rpx;
  font-size: 22rpx;
  color: #0f766e;
  background: #ccfbf1;
  border-radius: 999rpx;
}

.card__badge--active {
  color: #15803d;
  background: #dcfce7;
}
</style>
