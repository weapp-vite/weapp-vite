export interface VueCompatCase {
  key: string
  title: string
  path: string
  focus: string
  llmsTopic: string
  status: 'pass' | 'partial' | 'fail' | 'unknown'
}

export const vueCompatCases: VueCompatCase[] = [
  {
    key: 'template',
    title: '模板指令与绑定',
    path: '/pages/vue-compat/template/index',
    focus: 'v-if / v-for / v-model / class-style 绑定',
    llmsTopic: 'Template Syntax + Essentials',
    status: 'pass',
  },
  {
    key: 'reactivity',
    title: '响应式与侦听',
    path: '/pages/vue-compat/reactivity/index',
    focus: 'writable computed / cleanup watch / effectScope / customRef / toRef',
    llmsTopic: 'Reactivity Core',
    status: 'pass',
  },
  {
    key: 'script-setup',
    title: 'Script Setup 宏',
    path: '/pages/vue-compat/script-setup/index',
    focus: 'defineProps / defineEmits / defineModel / withDefaults / 原生组件 import（含 TS+SCSS）',
    llmsTopic: 'SFC <script setup>',
    status: 'pass',
  },
  {
    key: 'matrix',
    title: '能力矩阵',
    path: '/pages/vue-compat/matrix/index',
    focus: '按具体 Vue 写法列出 pass/partial/fail',
    llmsTopic: 'Compatibility Matrix',
    status: 'partial',
  },
]

export const compatCheckResult = {
  typecheck: 'pass',
  build: 'pass',
  note: '基于当前 wevu-vue-demo 的本地 typecheck/build 验证',
} as const
