import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { getComponentMarkup } from './componentMarkup'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(appRoot, '../..')
const pagesRoot = resolve(appRoot, 'src/pages/components')
const resolverListPath = resolve(repoRoot, 'packages/weapp-vite/src/auto-import-components/resolvers/json/wotUi.json')
const globalTypesPath = resolve(appRoot, 'node_modules/@wot-ui/ui/global.d.ts')
const checkOnly = process.argv.includes('--check')

function parseGlobalComponents(source: string) {
  return [...source.matchAll(/components\/(wd-[^/]+)\/\1\.vue/g)]
    .map(match => match[1])
    .filter((name, index, all) => all.indexOf(name) === index)
    .sort()
}

function renderInteractionValue(value: unknown) {
  if (typeof value === 'string') {
    return `'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`
  }
  if (Array.isArray(value)) {
    return `[${value.map(renderInteractionValue).join(', ')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .map(([key, item]) => `${key}: ${renderInteractionValue(item)}`)
    return `{ ${entries.join(', ')} }`
  }
  return String(value)
}

function renderTargetMarkup(component: string) {
  const spec = getComponentMarkup(component)
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

function renderInteractionRunner(component: string) {
  const interaction = getComponentMarkup(component).interaction
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
    const expectedInteraction = interaction.event
      ? `interactionCount.value > before`
      : `true`
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
  const expectedInteraction = interaction.event
    ? `interactionCount.value > before`
    : `true`
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

function renderPage(component: string) {
  const spec = getComponentMarkup(component)
  const targetMarkup = renderTargetMarkup(component)
  const interactionRunner = renderInteractionRunner(component)
  const interactionTracking = spec.interaction?.event
    ? `function markInteraction() {
  interactionCount.value += 1
}`
    : ''
  const additionalSetup = [spec.setup, interactionTracking]
    .filter(Boolean)
    .join('\n')
  const beforeInteraction = spec.interaction?.event
    ? '  const before = interactionCount.value\n'
    : ''
  return `<script setup lang="ts">
import { nextTick, ref } from 'wevu'

definePageJson({ navigationBarTitleText: '${component}' })

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
  const target = e2eComponent.value
    ?? page?.selectComponent?.('#e2e-component')
    ?? parent?.selectComponent?.('#e2e-component')
    ?? slotOwner?.selectComponent?.('#e2e-component')
    ?? null
  const rendered = target !== null
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

function renderScenarios(components: string[]) {
  const rows = components.map((component) => {
    const spec = getComponentMarkup(component)
    const interaction = spec.interaction
    const capability = interaction?.type ?? 'render'
    const action = interaction
      ? renderInteractionValue(interaction)
      : 'null'
    const expectedState = interaction?.type === 'command'
      ? `pass:command:${interaction.method}`
      : interaction?.type === 'model'
        ? `pass:model:${interaction.model}`
        : 'pass:render'
    return `  { component: '${component}', route: '/pages/components/${component}/index', parent: ${spec.parent ? `'${spec.parent}'` : 'null'}, capability: '${capability}', action: ${action}, expectedState: '${expectedState}' },`
  }).join('\n')
  return `export type ComponentScenarioAction = {
  type: 'command'
  method: string
  commandTarget?: 'component' | 'parent'
  delayBefore?: number
  delayAfter?: number
  args?: readonly unknown[]
  event?: string
  eventTarget?: 'component' | 'parent'
  expect?: {
    binding: string
    value: unknown
  }
  expectTarget?: {
    method: string
    value: unknown
  }
} | {
  type: 'model'
  model: string
  value: unknown
  event?: string
}

export interface ComponentScenario {
  component: string
  route: string
  parent: string | null
  capability: 'render' | 'command' | 'model'
  action: ComponentScenarioAction | null
  expectedState: string
}

export const componentScenarios = [
${rows}
] as const satisfies readonly ComponentScenario[]
`
}

function renderHome() {
  return `<script setup lang="ts">
import { componentScenarios } from '../../scenarios'

definePageJson({ navigationBarTitleText: 'Wot UI components' })

function open(route: string) {
  uni.navigateTo({ url: route })
}
</script>

<template>
  <view class="index-page">
    <view class="index-title">Wot UI 2.2.0</view>
    <view class="index-summary">{{ componentScenarios.length }} component scenarios</view>
    <view
      v-for="scenario in componentScenarios"
      :key="scenario.component"
      class="index-row"
      @tap="open(scenario.route)"
    >
      <text>{{ scenario.component }}</text>
      <text class="index-arrow">›</text>
    </view>
  </view>
</template>

<style>
.index-page {
  box-sizing: border-box;
  min-height: 100vh;
  padding: 24rpx;
}

.index-title {
  font-size: 38rpx;
  font-weight: 700;
}

.index-summary {
  margin: 8rpx 0 20rpx;
  color: #5f6670;
}

.index-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 76rpx;
  padding: 0 20rpx;
  margin-top: 8rpx;
  background: #fff;
  border: 2rpx solid #e1e4e8;
  border-radius: 8rpx;
}

.index-arrow {
  color: #1769e0;
}
</style>
`
}

function renderPrivateConfig(components: string[]) {
  const list = [
    { name: '组件索引', pathName: 'pages/index/index', query: '', scene: null },
    ...components.map(component => ({
      name: component,
      pathName: `pages/components/${component}/index`,
      query: '',
      scene: null,
    })),
  ]
  return JSON.stringify({
    description: 'Wot UI 全组件启动条件',
    projectname: 'wot-ui-compat',
    setting: { compileHotReLoad: false, urlCheck: false },
    condition: { miniprogram: { list } },
    libVersion: '3.15.0',
  }, null, 2)
}

async function assertOrWrite(filename: string, expected: string) {
  if (checkOnly) {
    const actual = await readFile(filename, 'utf8').catch(() => '')
    if (actual !== expected) {
      throw new Error(`生成文件已漂移: ${filename}`)
    }
    return
  }
  await mkdir(dirname(filename), { recursive: true })
  await writeFile(filename, expected)
}

async function main() {
  const [globalTypes, resolverSource] = await Promise.all([
    readFile(globalTypesPath, 'utf8'),
    readFile(resolverListPath, 'utf8'),
  ])
  const components = parseGlobalComponents(globalTypes)
  const resolverComponents = (JSON.parse(resolverSource) as string[]).toSorted()
  if (components.length !== 99 || JSON.stringify(components) !== JSON.stringify(resolverComponents)) {
    throw new Error(`Wot UI 声明与 resolver 不一致: global=${components.length}, resolver=${resolverComponents.length}`)
  }

  const expectedDirs = new Set(components)
  const existingDirs = await readdir(pagesRoot, { withFileTypes: true }).catch(() => [])
  const unexpected = existingDirs.filter(entry => entry.isDirectory() && !expectedDirs.has(entry.name))
  if (unexpected.length) {
    throw new Error(`存在未声明的组件页面: ${unexpected.map(entry => entry.name).join(', ')}`)
  }

  await Promise.all([
    ...components.map(component => assertOrWrite(resolve(pagesRoot, component, 'index.vue'), renderPage(component))),
    assertOrWrite(resolve(appRoot, 'src/scenarios.ts'), renderScenarios(components)),
    assertOrWrite(resolve(appRoot, 'src/pages/index/index.vue'), renderHome()),
    assertOrWrite(resolve(appRoot, 'project.private.config.json'), renderPrivateConfig(components)),
  ])
  console.log(`[wot-ui] ${checkOnly ? 'checked' : 'generated'} ${components.length} component pages`)
}

await main()
