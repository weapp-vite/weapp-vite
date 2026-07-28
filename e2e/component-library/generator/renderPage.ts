import type { ComponentMarkup } from './types'
import { renderInteractionValue } from './renderValue'

function renderStringLiteral(value: string) {
  return `'${value.replaceAll('\\', '\\\\').replaceAll(`'`, `\\'`)}'`
}

function renderTargetMarkup(component: string, spec: ComponentMarkup) {
  const componentEventBinding = spec.interaction?.event && spec.interaction.eventTarget !== 'parent'
    ? ` @${spec.interaction.event}="markInteraction"`
    : ''
  const targetTagPattern = new RegExp(`(<${component})(?=[\\s/>])([^>]*?)(/?)>`)
  if (!targetTagPattern.test(spec.markup)) {
    throw new Error(`组件场景缺少目标标签: ${component}`)
  }
  const targetMarkup = spec.markup.replace(
    targetTagPattern,
    (_match, openingTag: string, attributes: string, selfClosing: string) => {
      const closing = selfClosing ? ' />' : '>'
      return `${openingTag} id="e2e-component" ref="e2eComponent"${attributes.trimEnd()}${componentEventBinding}${closing}`
    },
  )
  if (!spec.parent || spec.parent === component) {
    return targetMarkup
  }

  const parentTagPattern = new RegExp(`(<${spec.parent})(?=[\\s/>])([^>]*?)(/?)>`)
  if (!parentTagPattern.test(targetMarkup)) {
    return targetMarkup
  }
  return targetMarkup.replace(
    parentTagPattern,
    (_match, openingTag: string, attributes: string, selfClosing: string) => {
      const closing = selfClosing ? ' />' : '>'
      const parentEventBinding = spec.interaction?.event && spec.interaction.eventTarget === 'parent'
        ? ` @${spec.interaction.event}="markInteraction"`
        : ''
      return `${openingTag} id="e2e-parent"${attributes.trimEnd()}${parentEventBinding}${closing}`
    },
  )
}

function renderInteractionRunner(component: string, spec: ComponentMarkup) {
  const interaction = spec.interaction
  if (!interaction) {
    return `  scenarioState.value = rendered ? 'pass:render' : 'fail:render'
  await nextTick()
  return {
    ok: rendered,
    component: '${component}',
    rendered,
    capability: 'render' as const,
    state: scenarioState.value,
    interactionCount: interactionCount.value,
  }`
  }

  if (interaction.type === 'model') {
    if (!/^[A-Z_$][\w$]*$/i.test(interaction.model)) {
      throw new Error(`组件场景 model 不是合法标识符: ${component} -> ${interaction.model}`)
    }
    const expectedInteraction = interaction.event ? `interactionCount.value > before` : `true`
    return `  ${interaction.model}.value = ${renderInteractionValue(interaction.value)}
  await nextTick()
  const ok = rendered && ${expectedInteraction}
  scenarioState.value = ok ? 'pass:model:${interaction.model}' : 'fail:model:${interaction.model}'
  return {
    ok,
    component: '${component}',
    rendered,
    capability: 'model' as const,
    state: scenarioState.value,
    interactionCount: interactionCount.value,
  }`
  }

  const args = renderInteractionValue(interaction.args ?? [])
  const commandTarget = interaction.commandTarget === 'parent' ? 'parent' : 'target'
  const delayBefore = interaction.delayBefore
    ? `  await new Promise<void>(resolve => setTimeout(resolve, ${interaction.delayBefore}))\n`
    : ''
  const delayAfter = interaction.delayAfter ?? 50
  const expectedInteraction = interaction.event ? `interactionCount.value > before` : `true`
  const expectedBinding = interaction.expect
    ? (() => {
        if (!/^[A-Z_$][\w$]*$/i.test(interaction.expect.binding)) {
          throw new Error(`组件场景 expect.binding 不是合法标识符: ${component} -> ${interaction.expect.binding}`)
        }
        return `Object.is(${interaction.expect.binding}.value, ${renderInteractionValue(interaction.expect.value)})`
      })()
    : `true`
  const expectedTargetState = interaction.expectTarget
    ? `typeof target?.${interaction.expectTarget.method} === 'function' && Object.is(target.${interaction.expectTarget.method}(), ${renderInteractionValue(interaction.expectTarget.value)})`
    : `true`
  const requiredEvent = interaction.event ?? 'none'
  return `${delayBefore}  const commandReceiver = ${commandTarget}
  const command = commandReceiver?.${interaction.method}
  const callable = typeof command === 'function'
  let commandError = ''
  if (callable) {
    try {
      const commandResult = command.apply(commandReceiver, ${args})
      if (commandResult && typeof (commandResult as PromiseLike<unknown>).then === 'function') {
        await Promise.race([
          Promise.resolve(commandResult).catch((error) => {
            commandError = error instanceof Error ? error.message : String(error)
          }),
          new Promise<void>(resolve => setTimeout(resolve, 100)),
        ])
      }
      await new Promise<void>(resolve => setTimeout(resolve, ${delayAfter}))
    }
    catch (error) {
      commandError = error instanceof Error ? error.message : String(error)
    }
  }
  const eventMatched = ${expectedInteraction}
  const stateMatched = ${expectedBinding}
  const targetStateMatched = ${expectedTargetState}
  const ok = rendered && callable && !commandError && eventMatched && stateMatched && targetStateMatched
  if (ok) {
    scenarioState.value = 'pass:command:${interaction.method}'
  }
  else if (commandError) {
    scenarioState.value = \`fail:error:\${commandError}\`
  }
  else if (!callable) {
    scenarioState.value = 'fail:missing-command:${interaction.method}'
  }
  else if (!eventMatched) {
    scenarioState.value = 'fail:event:${requiredEvent}'
  }
  else if (!stateMatched) {
    scenarioState.value = 'fail:state:${interaction.expect?.binding ?? 'none'}'
  }
  else {
    scenarioState.value = 'fail:target-state:${interaction.expectTarget?.method ?? 'none'}'
  }
  return {
    ok,
    component: '${component}',
    rendered,
    capability: 'command' as const,
    state: scenarioState.value,
    interactionCount: interactionCount.value,
  }`
}

export function renderComponentPage(component: string, spec: ComponentMarkup) {
  const componentNameCandidates = component.startsWith('up-')
    ? [component, component.replace(/^up-/, 'u-')]
    : [component]
  const renderedComponentNameCandidates = componentNameCandidates.map(renderStringLiteral).join(', ')
  const imports = [...(spec.imports ?? [])].toSorted((left, right) => {
    if (left.source === right.source) {
      return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
    }
    return left.source < right.source ? -1 : 1
  }).map(({ name, source }) => {
    if (!/^[A-Z_$][\w$]*$/i.test(name)) {
      throw new Error(`组件场景 import 名不是合法标识符: ${component} -> ${name}`)
    }
    return `import ${name} from '${source}'`
  }).join('\n')
  const targetMarkup = renderTargetMarkup(component, spec)
  const interactionRunner = renderInteractionRunner(component, spec)
  const interactionTracking = spec.interaction?.event
    ? `function markInteraction() {
  interactionCount.value += 1
}`
    : ''
  const additionalSetup = [spec.setup, interactionTracking].filter(Boolean).join('\n')
  const beforeInteraction = spec.interaction?.event ? '  const before = interactionCount.value\n' : ''
  return `<script setup lang="ts">
import { nextTick, ref } from 'wevu'
${imports ? `${imports}\n\n` : '\n'}definePageJson({ navigationBarTitleText: '${component}' })

const interactionCount = ref(0)
const scenarioState = ref('pending')
const e2eComponent = ref<Record<string, unknown> | null>(null)
${additionalSetup ? `${additionalSetup}\n` : ''}
async function runE2E() {
${beforeInteraction}  await nextTick()
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
    ? parentProxy.children.find((child: any) => [${renderedComponentNameCandidates}].includes(child?.$options?.name))
    : null
  const target = e2eComponent.value
    ?? page?.selectComponent?.('#e2e-component')
    ?? parent?.selectComponent?.('#e2e-component')
    ?? slotOwner?.selectComponent?.('#e2e-component')
    ?? page?.selectComponent?.('${component}')
    ?? page?.selectComponent?.('${spec.parent ? `${spec.parent} ${component}` : component}')
    ?? registeredChild
    ?? null
  const rendered = target !== null${spec.parent && spec.parent !== component ? ' || parent !== null' : ''}
${interactionRunner}
}
</script>

<template>
  <view id="e2e-root" class="scenario-page" data-component="${component}">
    <view class="scenario-header">
      <view class="scenario-title">${component}</view>
      <view class="scenario-status">rendered / interactive</view>
    </view>
    <view id="e2e-target" class="scenario-subject">
      ${targetMarkup}
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
`
}
