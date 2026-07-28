import type { ComponentMarkup } from './types'
import { renderInteractionValue } from './renderValue'

export function renderScenarios(components: string[], getComponentMarkup: (component: string) => ComponentMarkup) {
  const rows = components.map((component) => {
    const spec = getComponentMarkup(component)
    const interaction = spec.interaction
    const capability = interaction?.type ?? 'render'
    const action = interaction ? renderInteractionValue(interaction) : 'null'
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

export function renderHome(title: string, versionLabel: string) {
  return `<script setup lang="ts">
import { componentScenarios } from '../../scenarios'

definePageJson({ navigationBarTitleText: '${title} components' })

function open(route: string) {
  uni.navigateTo({ url: route })
}
</script>

<template>
  <view class="index-page">
    <view class="index-title">${versionLabel}</view>
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

export function renderPrivateConfig(
  components: string[],
  projectDescription: string,
  projectName: string,
) {
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
    description: projectDescription,
    projectname: projectName,
    setting: { compileHotReLoad: false, urlCheck: false },
    condition: { miniprogram: { list } },
    libVersion: '3.15.0',
  }, null, 2)
}
