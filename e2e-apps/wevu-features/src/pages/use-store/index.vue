<script setup lang="ts">
import { computed, nextTick, onUnload, ref, storeToRefs } from 'wevu'
import { getFeaturePluginRecords, useOptionsFeatureStore, useSetupFeatureStore } from '../../shared/store'

const setupStore = useSetupFeatureStore()
const optionsStore = useOptionsFeatureStore()
const setupRefs = storeToRefs({
  count: setupStore.count,
  label: setupStore.label,
  meta: setupStore.meta,
  doubled: setupStore.doubled,
})
const optionsRefs = storeToRefs({
  count: computed({
    get: () => optionsStore.count,
    set: (next: number) => {
      optionsStore.count = next
    },
  }),
  label: computed({
    get: () => optionsStore.label,
    set: (next: string) => {
      optionsStore.label = next
    },
  }),
  items: computed({
    get: () => optionsStore.items,
    set: (next: number[]) => {
      optionsStore.items = next
    },
  }),
  doubled: computed(() => optionsStore.doubled),
})

const metrics = {
  subscribeEventCount: 0,
  subscribeLastEvent: 'none',
  setupPatched: false,
  actionBeforeCount: 0,
  actionAfterCount: 0,
  actionErrorCount: 0,
  actionLastName: 'none',
}

const subscribeEventCount = ref(metrics.subscribeEventCount)
const subscribeLastEvent = ref(metrics.subscribeLastEvent)
const actionBeforeCount = ref(metrics.actionBeforeCount)
const actionAfterCount = ref(metrics.actionAfterCount)
const actionErrorCount = ref(metrics.actionErrorCount)
const actionLastName = ref(metrics.actionLastName)

function syncMetricsView() {
  subscribeEventCount.value = metrics.subscribeEventCount
  subscribeLastEvent.value = metrics.subscribeLastEvent
  actionBeforeCount.value = metrics.actionBeforeCount
  actionAfterCount.value = metrics.actionAfterCount
  actionErrorCount.value = metrics.actionErrorCount
  actionLastName.value = metrics.actionLastName
}

const unsubSetupSubscribe = setupStore.$subscribe((mutation) => {
  metrics.subscribeEventCount += 1
  metrics.subscribeLastEvent = `setup:${mutation.type}`
  if (mutation.type.includes('patch')) {
    metrics.setupPatched = true
  }
})

const unsubOptionsSubscribe = optionsStore.$subscribe((mutation) => {
  metrics.subscribeEventCount += 1
  metrics.subscribeLastEvent = `options:${mutation.type}`
})

const unsubSetupAction = setupStore.$onAction(({ name, after, onError }) => {
  metrics.actionBeforeCount += 1
  metrics.actionLastName = name
  after(() => {
    metrics.actionAfterCount += 1
  })
  onError(() => {
    metrics.actionErrorCount += 1
  })
})

onUnload(() => {
  unsubSetupSubscribe()
  unsubOptionsSubscribe()
  unsubSetupAction()
})

const setupCountValue = computed(() => setupRefs.count.value)
const setupDoubledValue = computed(() => setupRefs.doubled.value)
const setupLabelValue = computed(() => setupRefs.label.value)
const setupVisitsValue = computed(() => setupRefs.meta.value.visits)

const optionsCountValue = computed(() => optionsRefs.count.value)
const optionsDoubledValue = computed(() => optionsRefs.doubled.value)
const optionsLabelValue = computed(() => optionsRefs.label.value)
const optionsItemsSizeValue = computed(() => optionsRefs.items.value.length)

const setupPanelClassName = computed(() => (setupCountValue.value % 2 === 0 ? 'panel-calm' : 'panel-active'))
const optionsPanelClassName = computed(() => (optionsCountValue.value % 2 === 0 ? 'panel-calm' : 'panel-active'))
const pluginSummary = computed(() => JSON.stringify(getFeaturePluginRecords()))

function setupInc() {
  setupStore.inc(1)
  syncMetricsView()
}

function setupVisit() {
  setupStore.visit()
  syncMetricsView()
}

function setupRenameAlpha() {
  setupStore.rename('setup-alpha')
  syncMetricsView()
}

function setupPatchObject() {
  setupStore.$patch({
    __setupObjectPatched: true,
  })
  syncMetricsView()
}

function setupPatchFunction() {
  setupStore.$patch((state: any) => {
    state.__setupFunctionPatched = true
  })
  syncMetricsView()
}

function setupRefWrite() {
  setupRefs.count.value = 4
  syncMetricsView()
}

function setupReset() {
  setupStore.$reset()
  syncMetricsView()
}

function optionsInc() {
  optionsStore.inc(1)
  syncMetricsView()
}

function optionsRenameBeta() {
  optionsStore.rename('options-beta')
  syncMetricsView()
}

function optionsPatchObject() {
  optionsStore.$patch({
    label: 'options-patched',
  })
  syncMetricsView()
}

function optionsPatchFunction() {
  optionsStore.$patch((state) => {
    state.count = 3
  })
  syncMetricsView()
}

function optionsRefWrite() {
  optionsRefs.count.value = 7
  syncMetricsView()
}

function optionsReset() {
  optionsStore.$reset()
  syncMetricsView()
}

async function runE2E() {
  setupInc()
  setupVisit()
  setupRenameAlpha()
  setupPatchObject()
  setupPatchFunction()
  setupRefWrite()

  optionsInc()
  optionsRenameBeta()
  optionsPatchObject()
  optionsPatchFunction()
  optionsRefWrite()
  await nextTick()
  syncMetricsView()

  const beforeResetChecks = {
    setupCount: setupStore.count.value === 4,
    setupLabel: setupStore.label.value === 'setup-alpha',
    setupVisits: setupStore.meta.visits === 1,
    optionsCount: optionsStore.count === 7,
    optionsLabel: optionsStore.label === 'options-patched',
    optionsItems: optionsStore.items.length > 0,
    setupPatched: metrics.setupPatched,
  }

  setupReset()
  optionsReset()
  await nextTick()
  syncMetricsView()

  const afterResetChecks = {
    setupResetCount: setupStore.count.value === 0,
    setupResetLabel: setupStore.label.value === 'init',
    setupResetVisits: setupStore.meta.visits === 0,
    optionsResetCount: optionsStore.count === 0,
    optionsResetLabel: optionsStore.label === 'zero',
    pluginTouched: Boolean((setupStore as any).__featurePluginTouched) && Boolean((optionsStore as any).__featurePluginTouched),
    subscribeTriggered: metrics.subscribeEventCount > 0,
    actionTriggered: metrics.actionBeforeCount > 0 && metrics.actionAfterCount > 0,
  }

  const checks = {
    ...beforeResetChecks,
    ...afterResetChecks,
  }

  return {
    ok: Object.values(checks).every(Boolean),
    checks,
    details: {
      setup: {
        count: setupStore.count.value,
        label: setupStore.label.value,
        visits: setupStore.meta.visits,
      },
      options: {
        count: optionsStore.count,
        label: optionsStore.label,
        items: optionsStore.items.slice(),
      },
      subscribeEventCount: metrics.subscribeEventCount,
      subscribeLastEvent: metrics.subscribeLastEvent,
      setupPatched: metrics.setupPatched,
      actionBeforeCount: metrics.actionBeforeCount,
      actionAfterCount: metrics.actionAfterCount,
      actionErrorCount: metrics.actionErrorCount,
      actionLastName: metrics.actionLastName,
      pluginRecords: getFeaturePluginRecords(),
    },
  }
}

const _runE2E = runE2E
syncMetricsView()
</script>

<template>
  <view class="use-store-page">
    <view class="use-store-page__title">
      wevu store 特性展示
    </view>
    <view class="use-store-page__subtitle">
      展示 setup/options store、storeToRefs、patch/reset、subscribe/onAction/plugin
    </view>

    <view id="store-plugin-records" class="use-store-page__meta">
      plugin records = {{ pluginSummary }}
    </view>
    <view id="store-subscribe-count" class="use-store-page__meta">
      subscribe count = {{ subscribeEventCount }}
    </view>
    <view id="store-subscribe-last" class="use-store-page__meta">
      subscribe last = {{ subscribeLastEvent }}
    </view>
    <view id="store-action-counts" class="use-store-page__meta">
      action before/after/error = {{ actionBeforeCount }}/{{ actionAfterCount }}/{{ actionErrorCount }}
    </view>
    <view id="store-action-last" class="use-store-page__meta">
      action last = {{ actionLastName }}
    </view>

    <view class="use-store-page__section" :class="setupPanelClassName">
      <view class="use-store-page__section-title">
        setup store
      </view>
      <view id="store-setup-count" class="use-store-page__line">
        setup count = {{ setupCountValue }}
      </view>
      <view id="store-setup-doubled" class="use-store-page__line">
        setup doubled = {{ setupDoubledValue }}
      </view>
      <view id="store-setup-label" class="use-store-page__line">
        setup label = {{ setupLabelValue }}
      </view>
      <view id="store-setup-visits" class="use-store-page__line">
        setup visits = {{ setupVisitsValue }}
      </view>

      <view class="use-store-page__toolbar">
        <view id="store-setup-inc" class="use-store-page__btn" @tap="setupInc">
          setup inc
        </view>
        <view id="store-setup-visit" class="use-store-page__btn" @tap="setupVisit">
          setup visit
        </view>
        <view id="store-setup-rename" class="use-store-page__btn" @tap="setupRenameAlpha">
          setup rename
        </view>
        <view id="store-setup-patch-object" class="use-store-page__btn" @tap="setupPatchObject">
          setup patch object
        </view>
        <view id="store-setup-patch-fn" class="use-store-page__btn" @tap="setupPatchFunction">
          setup patch fn
        </view>
        <view id="store-setup-ref-write" class="use-store-page__btn" @tap="setupRefWrite">
          setup refs write
        </view>
        <view id="store-setup-reset" class="use-store-page__btn" @tap="setupReset">
          setup reset
        </view>
      </view>
    </view>

    <view class="use-store-page__section" :class="optionsPanelClassName">
      <view class="use-store-page__section-title">
        options store
      </view>
      <view id="store-options-count" class="use-store-page__line">
        options count = {{ optionsCountValue }}
      </view>
      <view id="store-options-doubled" class="use-store-page__line">
        options doubled = {{ optionsDoubledValue }}
      </view>
      <view id="store-options-label" class="use-store-page__line">
        options label = {{ optionsLabelValue }}
      </view>
      <view id="store-options-items-size" class="use-store-page__line">
        options items = {{ optionsItemsSizeValue }}
      </view>

      <view class="use-store-page__toolbar">
        <view id="store-options-inc" class="use-store-page__btn" @tap="optionsInc">
          options inc
        </view>
        <view id="store-options-rename" class="use-store-page__btn" @tap="optionsRenameBeta">
          options rename
        </view>
        <view id="store-options-patch-object" class="use-store-page__btn" @tap="optionsPatchObject">
          options patch object
        </view>
        <view id="store-options-patch-fn" class="use-store-page__btn" @tap="optionsPatchFunction">
          options patch fn
        </view>
        <view id="store-options-ref-write" class="use-store-page__btn" @tap="optionsRefWrite">
          options refs write
        </view>
        <view id="store-options-reset" class="use-store-page__btn" @tap="optionsReset">
          options reset
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.use-store-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  background: #f8fafc;
}

.use-store-page__title {
  font-size: 32rpx;
  font-weight: 700;
  color: #0f172a;
}

.use-store-page__subtitle {
  margin-top: 10rpx;
  font-size: 22rpx;
  color: #475569;
}

.use-store-page__meta {
  margin-top: 10rpx;
  font-size: 20rpx;
  color: #334155;
  word-break: break-all;
}

.use-store-page__section {
  margin-top: 16rpx;
  padding: 16rpx;
  border-radius: 14rpx;
  border: 2rpx solid #cbd5e1;
}

.use-store-page__section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #0f172a;
}

.use-store-page__line {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #334155;
}

.use-store-page__toolbar {
  margin-top: 12rpx;
  display: flex;
  flex-wrap: wrap;
}

.use-store-page__btn {
  margin: 6rpx;
  min-height: 56rpx;
  line-height: 56rpx;
  padding: 0 14rpx;
  border-radius: 9999rpx;
  background: #e2e8f0;
  color: #1f2937;
  font-size: 22rpx;
}

.panel-calm {
  background: #f1f5f9;
}

.panel-active {
  background: #dcfce7;
}
</style>
