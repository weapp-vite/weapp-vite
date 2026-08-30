import type { CompilerDiagnosticCode } from '../../../types/diagnostics'
import { CompilerDiagnosticCodes } from '../../../types/diagnostics'

export interface VueUpstreamCompatibilityCase {
  category: string
  source: string
  upstream: string
  tags: string[]
  directives: string[]
  wxmlIncludes: string[]
  diagnosticCodes?: CompilerDiagnosticCode[]
}

export const VUE_UPSTREAM_COMPATIBILITY_SOURCE = {
  repository: 'vuejs/core',
  tag: 'v3.5.42',
  license: 'MIT',
  packages: ['@vue/compiler-dom', '@vue/compiler-sfc'],
} as const

/**
 * 从 Vue 官方编译器语义中提取的小程序相关最小用例。
 * 这里只固定解析结构和 WXML 稳定语义，不复制 DOM codegen 结果。
 */
export const VUE_UPSTREAM_COMPATIBILITY_CASES: VueUpstreamCompatibilityCase[] = [
  {
    category: 'interpolation',
    source: '<view>{{ message }}</view>',
    upstream: 'compiler-core/parse/interpolation',
    tags: ['view'],
    directives: [],
    wxmlIncludes: ['<view>{{message}}</view>'],
  },
  {
    category: 'v-if',
    source: '<view v-if="ready">ready</view>',
    upstream: 'compiler-core/transforms/vIf',
    tags: ['view'],
    directives: ['if'],
    wxmlIncludes: ['wx:if="{{ready}}"'],
  },
  {
    category: 'v-for-key',
    source: '<view v-for="item in items" :key="item.id">{{ item.label }}</view>',
    upstream: 'compiler-core/transforms/vFor',
    tags: ['view'],
    directives: ['for', 'bind'],
    wxmlIncludes: ['wx:for="{{items}}"', 'wx:key="id"'],
  },
  {
    category: 'bind-on',
    source: '<button :id="buttonId" @tap="handleTap">tap</button>',
    upstream: 'compiler-core/transforms/vBind,vOn',
    tags: ['button'],
    directives: ['bind', 'on'],
    wxmlIncludes: ['id="{{buttonId}}"', 'bindtap="handleTap"'],
  },
  {
    category: 'component-v-model',
    source: '<Panel v-model="value" />',
    upstream: 'compiler-core/transforms/vModel',
    tags: ['Panel'],
    directives: ['model'],
    wxmlIncludes: ['modelValue="{{value}}"', 'bind:update-modelvalue="__weapp_vite_inline"'],
  },
  {
    category: 'named-slot',
    source: '<Panel><template #header="props"><text>{{ props.title }}</text></template></Panel>',
    upstream: 'compiler-core/transforms/vSlot',
    tags: ['Panel', 'template', 'text'],
    directives: ['slot'],
    wxmlIncludes: ['vue-slots=', 'generic:scoped-slots-header='],
  },
  {
    category: 'dynamic-component',
    source: '<component :is="current" />',
    upstream: 'compiler-core/transforms/transformElement',
    tags: ['component'],
    directives: ['bind'],
    wxmlIncludes: ['data-is="{{current}}"'],
    diagnosticCodes: [CompilerDiagnosticCodes.templateRuntimeRequired],
  },
  {
    category: 'html-void-v-model',
    source: '<input v-model="value">',
    upstream: 'compiler-dom/parserOptions',
    tags: ['input'],
    directives: ['model'],
    wxmlIncludes: ['<input value="{{value}}"'],
  },
  {
    category: 'custom-directive',
    source: '<view v-analytics />',
    upstream: 'compiler-core/parse/directive',
    tags: ['view'],
    directives: ['analytics'],
    wxmlIncludes: ['data-v-analytics'],
    diagnosticCodes: [CompilerDiagnosticCodes.templateRuntimeRequired],
  },
  {
    category: 'v-html',
    source: '<view v-html="html" />',
    upstream: 'compiler-dom/transforms/vHtml',
    tags: ['view'],
    directives: ['html'],
    wxmlIncludes: ['<view />'],
    diagnosticCodes: [CompilerDiagnosticCodes.templateUnsupportedDirective],
  },
]
