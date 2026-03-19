import dayjs from 'dayjs'

export type PluginFeatureKind = 'vue-sfc' | 'native-ts' | 'scss'

export interface PluginFeatureCard {
  id: string
  title: string
  summary: string
  kind: PluginFeatureKind
  kindLabel: string
  score: number
}

const featureCards: PluginFeatureCard[] = [
  {
    id: 'vue-page',
    title: '插件页面支持 Vue SFC',
    summary: '页面直接使用 <script setup lang="ts">、definePageJson 与 wevu 响应式状态。',
    kind: 'vue-sfc',
    kindLabel: 'Vue SFC',
    score: 96,
  },
  {
    id: 'public-component',
    title: '插件公开组件也可以是 Vue SFC',
    summary: '宿主通过 plugin:// 引用 Vue SFC 组件，运行时仍保持小程序组件语义。',
    kind: 'vue-sfc',
    kindLabel: 'Vue SFC',
    score: 91,
  },
  {
    id: 'native-meter',
    title: '插件原生组件支持 TypeScript',
    summary: '原生 Component 入口可以写成 index.ts，并保留属性类型约束与默认值。',
    kind: 'native-ts',
    kindLabel: 'Native TS',
    score: 88,
  },
  {
    id: 'scss-pipeline',
    title: '插件样式可直接走 SCSS 管线',
    summary: '无论是原生组件的独立 .scss，还是 Vue SFC 的 <style lang="scss"> 都可正常编译。',
    kind: 'scss',
    kindLabel: 'SCSS',
    score: 93,
  },
]

const pluginNpmBuildStamp = dayjs('2026-03-19T12:34:00').format('YYYY/MM/DD HH:mm')

/**
 * 返回用于展示的插件能力卡片。
 */
export function getFeatureCards() {
  return featureCards.map(card => ({ ...card }))
}

/**
 * 返回按类别筛选后的插件能力卡片。
 */
export function getFeatureCardsByKind(kind: PluginFeatureKind | 'all') {
  if (kind === 'all') {
    return getFeatureCards()
  }
  return featureCards
    .filter(card => card.kind === kind)
    .map(card => ({ ...card }))
}

/**
 * 返回能力类别的中文标签。
 */
export function getFeatureKindLabel(kind: PluginFeatureKind) {
  const labelMap: Record<PluginFeatureKind, string> = {
    'vue-sfc': 'Vue SFC',
    'native-ts': 'Native TS',
    scss: 'SCSS',
  }
  return labelMap[kind]
}

/**
 * 根据得分返回展示组件使用的色调。
 */
export function getScoreTone(score: number) {
  if (score >= 92) {
    return 'success'
  }
  if (score >= 80) {
    return 'neutral'
  }
  return 'danger'
}

/**
 * 返回插件能力总览文案。
 */
export function getPluginShowcaseSummary() {
  const total = featureCards.length
  const average = Math.round(featureCards.reduce((sum, item) => sum + item.score, 0) / total)
  return `插件共暴露 ${total} 个示例切面，平均完成度 ${average}%，npm(dayjs) 构建标记 ${pluginNpmBuildStamp}`
}
