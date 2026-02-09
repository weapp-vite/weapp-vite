import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    vue: true,
    // tailwindcss: true,
    ignores: [
      '**/fixtures/**',
      'website/guide/npm.md',
      'website/guide/wxs.md',
      'website/guide/json-intelli-sense.md',
      'website/config/*.md',
      'website/snippets',
      '**/*.auto.{js,ts}',
      'website/blog/release1_7.md',
      'node_modules/**',
      'packages/vite-plugin-performance/*.md',
      'website/guide/module.md',
      'packages/weapp-vite/modules/**',
      'website/blog/release6.md',
      'docs/core-architecture.md',
      'e2e-apps/**/project.config.json',
      'templates/**/project.config.json',
      'templates/**/project.private.config.json',
      'e2e-apps/**/dist/**',
      'e2e-apps/**/dist-*/**',
      'e2e-apps/**/miniprogram_dist/**',
      '.qoder/**',
      '.changeset/**',
    ],
    languageOptions: {
      globals: {
        getRegExp: true,
        getDate: true,
        wx: true,
        Page: true,
        App: true,
        Component: true,
        requirePlugin: true,
        getApp: true,
        getCurrentPages: true,
        WechatMiniprogram: true,
      },
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/valid-v-on': ['error', { modifiers: ['catch', 'mut', 'capture'] }],
    },
  },
  {
    files: ['packages/**/src/**/*.{js,ts,mjs,cjs}', '@weapp-core/**/src/**/*.{js,ts,mjs,cjs}', 'scripts/**/*.{js,ts,mjs,cjs}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'chalk',
            message: '请使用 @weapp-core/logger 暴露的 colors 统一进行终端染色。',
          },
          {
            name: 'picocolors',
            message: '请使用 @weapp-core/logger 暴露的 colors 统一进行终端染色。',
          },
          {
            name: 'colorette',
            message: '请使用 @weapp-core/logger 暴露的 colors 统一进行终端染色。',
          },
          {
            name: 'kleur',
            message: '请使用 @weapp-core/logger 暴露的 colors 统一进行终端染色。',
          },
          {
            name: 'ansi-colors',
            message: '请使用 @weapp-core/logger 暴露的 colors 统一进行终端染色。',
          },
          {
            name: 'yoctocolors',
            message: '请使用 @weapp-core/logger 暴露的 colors 统一进行终端染色。',
          },
        ],
      }],
      'no-restricted-syntax': ['error', {
        selector: 'Literal[raw*="\\u001B["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }, {
        selector: 'Literal[raw*="\\u001b["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }, {
        selector: 'Literal[raw*="\\x1B["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }, {
        selector: 'Literal[raw*="\\x1b["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }, {
        selector: 'TemplateElement[value.raw*="\\u001B["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }, {
        selector: 'TemplateElement[value.raw*="\\u001b["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }, {
        selector: 'TemplateElement[value.raw*="\\x1B["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }, {
        selector: 'TemplateElement[value.raw*="\\x1b["]',
        message: '请勿手写 ANSI 转义，改为使用 @weapp-core/logger 暴露的 colors。',
      }],
    },
  },
  {
    files: ['@weapp-core/logger/src/index.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['./packages/rolldown-require/**/*.ts'],
    rules: {
      'style/max-statements-per-line': 'off',
      'ts/no-use-before-define': 'off',
      'no-cond-assign': 'off',
      'ts/no-unsafe-function-type': 'off',
    },
  },
  {
    files: ['apps/weapp-vite-web-demo/src/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['apps/wevu-vue-demo/src/**/*.vue'],
    rules: {
      'no-console': 'off',
      'ts/no-unused-vars': 'off',
    },
  },
)
