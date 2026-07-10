import { getSharedLoadMessage, SHARED_ANSWER } from '@/shared/shared-data'

interface PluginFeatureCard {
  id: string
  title: string
  summary: string
  kindLabel: string
  score: number
}

// 插件 main 由 requirePlugin 直接加载，必须保持自包含，不能依赖页面侧共享 chunk。
const publicFeatureCards: PluginFeatureCard[] = [
  {
    id: 'vue-page',
    title: '插件页面支持 Vue SFC',
    summary: '页面直接使用 <script setup lang="ts">、definePageJson 与 wevu 响应式状态。',
    kindLabel: 'Vue SFC',
    score: 96,
  },
  {
    id: 'public-component',
    title: '插件公开组件也可以是 Vue SFC',
    summary: '宿主通过 plugin:// 引用 Vue SFC 组件，运行时仍保持小程序组件语义。',
    kindLabel: 'Vue SFC',
    score: 91,
  },
  {
    id: 'native-meter',
    title: '插件原生组件支持 TypeScript',
    summary: '原生 Component 入口可以写成 index.ts，并保留属性类型约束与默认值。',
    kindLabel: 'Native TS',
    score: 88,
  },
  {
    id: 'scss-pipeline',
    title: '插件样式可直接走 SCSS 管线',
    summary: '无论是原生组件的独立 .scss，还是 Vue SFC 的 <style lang="scss"> 都可正常编译。',
    kindLabel: 'SCSS',
    score: 93,
  },
]

export function sayHello() {
  // eslint-disable-next-line no-console
  console.log(getSharedLoadMessage('plugin'))
}

export const answer = SHARED_ANSWER

export function getShowcaseSummary() {
  const average = Math.round(publicFeatureCards.reduce((sum, item) => sum + item.score, 0) / publicFeatureCards.length)
  return `插件共暴露 ${publicFeatureCards.length} 个示例切面，平均完成度 ${average}%，npm(dayjs) 构建标记 2026/03/19 12:34`
}

export function getFeatureCards() {
  return publicFeatureCards.map(card => ({ ...card }))
}
