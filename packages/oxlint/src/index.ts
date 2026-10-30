import type { OxlintConfig } from 'vite-plus/lint'
import {
  MINI_PROGRAM_RUNTIME_DEFAULT_FILES,
  MINI_PROGRAM_RUNTIME_DEFAULT_IGNORES,
} from '@weapp-vite/eslint'

const runtimeRules = {
  'weapp-vite/no-unsupported-runtime-api': 'error',
  'weapp-vite/no-implicit-runtime-polyfill': 'warn',
} satisfies NonNullable<OxlintConfig['rules']>

const compatibilityRules = {
  'weapp-vite/no-unsupported-api': 'error',
  'weapp-vite/no-risky-api': 'warn',
} satisfies NonNullable<OxlintConfig['rules']>

function createPreset(wevu: boolean) {
  return {
    categories: { correctness: 'warn' },
    env: { builtin: true, browser: false, node: false },
    jsPlugins: [{ name: 'weapp-vite', specifier: '@weapp-vite/oxlint/plugin' }],
    ignorePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-*/**',
      '**/.weapp-vite/**',
      '**/miniprogram_npm/**',
      '**/generated/**',
    ],
    rules: {
      'no-debugger': 'error',
      'eqeqeq': 'error',
    },
    overrides: [
      {
        files: [...MINI_PROGRAM_RUNTIME_DEFAULT_FILES],
        excludeFiles: [...MINI_PROGRAM_RUNTIME_DEFAULT_IGNORES, '**/*.{wxs,sjs,ks}.{js,ts}', '**/*.filter.{js,ts}'],
        globals: {
          App: 'readonly',
          Page: 'readonly',
          Component: 'readonly',
          Behavior: 'readonly',
          getApp: 'readonly',
          getCurrentPages: 'readonly',
          wx: 'readonly',
          require: 'readonly',
        },
        rules: wevu ? { ...runtimeRules, ...compatibilityRules } : { ...runtimeRules },
      },
      {
        files: ['*.config.*', 'scripts/**', '**/*.{test,spec}.{js,mjs,cjs,jsx,ts,mts,cts,tsx}'],
        env: { node: true },
      },
    ],
  } satisfies OxlintConfig
}

/** 原生小程序的脚本检查预设，不启用浏览器或 DOM 环境。 */
export const miniProgramRecommended = createPreset(false)

/** 在小程序脚本检查基础上增加 Wevu 的上游 API 兼容诊断。 */
export const wevuRecommended = {
  ...createPreset(true),
  plugins: ['typescript', 'unicorn', 'oxc', 'vue'],
} satisfies OxlintConfig

/** React 小程序增加 Hooks 约束，仍沿用小程序宿主环境。 */
export const reactRecommended = {
  ...createPreset(false),
  plugins: ['typescript', 'unicorn', 'oxc', 'react'],
  rules: {
    ...miniProgramRecommended.rules,
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
  },
} satisfies OxlintConfig
