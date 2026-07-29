<script setup lang="ts">
import { nextTick, ref } from 'wevu'

definePageJson({ navigationBarTitleText: 'wd-grid-item' })

const interactionCount = ref(0)
const scenarioState = ref('pending')
const e2eComponent = ref<Record<string, unknown> | null>(null)
function markInteraction() {
  interactionCount.value += 1
}

async function runE2E() {
  const before = interactionCount.value
  await nextTick()
  for (let attempt = 0; attempt < 20 && !e2eComponent.value; attempt += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 25))
  }
  const pages = getCurrentPages()
  interface SelectorOwner {
    [key: string]: unknown
    selectComponent?: (selector: string) => Record<string, unknown> | null
  }
  const page = pages[pages.length - 1] as SelectorOwner | undefined
  const parent = page?.selectComponent?.('#e2e-parent') as SelectorOwner | null | undefined
  const slotOwner = parent?.selectComponent?.('scoped-slots-default') as SelectorOwner | null | undefined
  const parentProxy = (parent as any)?.__wevu?.proxy
  const registeredChild = Array.isArray(parentProxy?.children)
    ? parentProxy.children.find((child: any) => ['wd-grid-item'].includes(child?.$options?.name))
    : null
  const target = e2eComponent.value
    ?? page?.selectComponent?.('#e2e-component')
    ?? parent?.selectComponent?.('#e2e-component')
    ?? slotOwner?.selectComponent?.('#e2e-component')
    ?? page?.selectComponent?.('wd-grid-item')
    ?? page?.selectComponent?.('wd-grid wd-grid-item')
    ?? registeredChild
    ?? null
  const rendered = target !== null || parent !== null
  const commandReceiver = target
  const command = commandReceiver?.click
  const callable = typeof command === 'function'
  let commandError = ''
  if (callable) {
    try {
      const commandResult = command.apply(commandReceiver, [])
      if (commandResult && typeof (commandResult as PromiseLike<unknown>).then === 'function') {
        await Promise.race([
          Promise.resolve(commandResult).catch((error) => {
            commandError = error instanceof Error ? error.message : String(error)
          }),
          new Promise<void>(resolve => setTimeout(resolve, 100)),
        ])
      }
      await new Promise<void>(resolve => setTimeout(resolve, 50))
    }
    catch (error) {
      commandError = error instanceof Error ? error.message : String(error)
    }
  }
  const eventMatched = interactionCount.value > before
  const stateMatched = true
  const targetStateMatched = true
  const ok = rendered && callable && !commandError && eventMatched && stateMatched && targetStateMatched
  if (ok) {
    scenarioState.value = 'pass:command:click'
  }
  else if (commandError) {
    scenarioState.value = `fail:error:${commandError}`
  }
  else if (!callable) {
    scenarioState.value = 'fail:missing-command:click'
  }
  else if (!eventMatched) {
    scenarioState.value = 'fail:event:click'
  }
  else if (!stateMatched) {
    scenarioState.value = 'fail:state:none'
  }
  else {
    scenarioState.value = 'fail:target-state:none'
  }
  return {
    ok,
    component: 'wd-grid-item',
    rendered,
    capability: 'command' as const,
    state: scenarioState.value,
    interactionCount: interactionCount.value,
  }
}
</script>

<template>
  <view id="e2e-root" class="scenario-page" data-component="wd-grid-item">
    <view class="scenario-header">
      <view class="scenario-title">wd-grid-item</view>
      <view class="scenario-status">rendered / interactive</view>
    </view>
    <view id="e2e-target" class="scenario-subject">
      <wd-grid id="e2e-parent" :column="1" :clickable="true"><wd-grid-item id="e2e-component" ref="e2eComponent" icon="home" text="Grid item" @click="markInteraction" /></wd-grid>
    </view>
    <button id="e2e-action" class="scenario-action" @click="runE2E">
      Exercise interaction
    </button>
    <view id="e2e-state" class="scenario-state">{{ scenarioState }} / interaction={{ interactionCount }}</view>
  </view>
</template>

<style>
.scenario-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
  background: #f5f6f8;
}

.scenario-header {
  padding-bottom: 20rpx;
  border-bottom: 2rpx solid #d9dde3;
}

.scenario-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2329;
}

.scenario-status,
.scenario-state {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #5f6670;
}

.scenario-subject {
  min-height: 180rpx;
  padding: 28rpx 12rpx;
  margin-top: 24rpx;
  overflow: visible;
  background: #fff;
  border: 2rpx solid #e1e4e8;
  border-radius: 8rpx;
}

.scenario-action {
  margin-top: 24rpx;
  color: #fff;
  background: #1769e0;
  border-radius: 8rpx;
}

.badge-anchor,
.curtain-content,
.grid-block,
.transition-content,
.watermark-content {
  padding: 20rpx;
  background: #eef3fa;
}
</style>
