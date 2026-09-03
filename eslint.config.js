import { createJiti } from 'jiti'
import { defineEslintConfig } from 'repoctl/tooling'

const jiti = createJiti(import.meta.url)
const {
  createMiniProgramRuntimeConfig,
  miniProgramRuntimePlugin,
} = await jiti.import('./packages/eslint/src/miniProgramRuntime.ts')

export default await defineEslintConfig({
  options: {
    miniProgram: true,
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
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-*/**',
      '**/dist-plugin/**',
      '**/dist-web/**',
      '**/build/**',
      '**/coverage/**',
      '**/miniprogram_npm/**',
      '**/.vite/**',
      '**/.vite-inspect/**',
      '**/.turbo/**',
      '**/.cache/**',
      '**/.smartapp-automator/**',
      '**/__temp__/**',
      '**/.tmp/**',
      '**/.weapp-vite/**',
      '**/.wevu-config/**',
      'website/blog/release1_7.md',
      'node_modules/**',
      'packages/vite-plugin-performance/*.md',
      'website/guide/module.md',
      'packages/weapp-vite/modules/**',
      'packages/miniprogram-automator/src/internal/qr/vendor/reader/**',
      'packages/miniprogram-automator/src/internal/qr/vendor/terminal/**',
      'packages/qr/src/vendor/reader/**',
      'packages/qr/src/vendor/terminal/**',
      'templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/category/components/goods-category/components/c-sidebar/README.md',
      'website/blog/release6.md',
      'docs/core-architecture.md',
      'apps/**/project.config.json',
      'apps/**/project.private.config.json',
      'e2e-apps/**/project.config.json',
      'e2e-apps/**/project.private.config.json',
      'templates/**/project.config.json',
      'templates/**/project.private.config.json',
      'e2e-apps/**/dist/**',
      'e2e-apps/**/dist-*/**',
      'e2e-apps/**/miniprogram_dist/**',
      'docs/reports/**',
      '.qoder/**',
      '.changeset/**',
    ],
    configs: [{
      rules: {
        'vue/no-useless-template-attributes': 'off',
      },
    }, {
      files: ['packages/dashboard/**/*.{js,ts,mjs,cjs,vue}'],
      rules: {
        'wevu/no-risky-api': 'off',
        'wevu/no-unsupported-api': 'off',
        'wevu/no-unsupported-template-feature': 'off',
      },
    }, {
      files: ['**/*.md', '**/*.md/**'],
      rules: {
        'wevu/no-risky-api': 'off',
        'wevu/no-unsupported-api': 'off',
        'wevu/no-unsupported-template-feature': 'off',
      },
    }, {
      files: ['**/*.vue'],
      rules: {
        'vue/valid-v-on': ['error', { modifiers: ['catch', 'mut', 'capture'] }],
      },
    }, {
      ...createMiniProgramRuntimeConfig({
        files: [
          'packages-runtime/wevu/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
          'packages-runtime/web-apis/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
          '@weapp-core/shared/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
          'e2e-apps/*/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
          'templates/*/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
        ],
      }),
    }, {
      files: [
        'packages-runtime/wevu/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
        '@weapp-core/shared/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}',
      ],
      ignores: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/src/node.{js,mjs,cjs,jsx,ts,mts,cts,tsx}',
      ],
      plugins: {
        'mini-program': miniProgramRuntimePlugin,
      },
      rules: {
        'mini-program/no-unsupported-runtime-api': 'error',
        'mini-program/no-implicit-runtime-polyfill': 'error',
      },
    }, {
      files: ['packages-runtime/web-apis/src/**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx,vue}'],
      plugins: {
        'mini-program': miniProgramRuntimePlugin,
      },
      rules: {
        // web-apis 是显式兼容层实现，读取宿主能力后自行提供 fallback。
        'mini-program/no-implicit-runtime-polyfill': 'off',
      },
    }, {
      files: [
        'packages/**/src/**/*.{js,ts,mjs,cjs,vue}',
        'packages-runtime/**/src/**/*.{js,ts,mjs,cjs,vue}',
        '@weapp-core/**/src/**/*.{js,ts,mjs,cjs,vue}',
        'apps/**/src/**/*.{js,ts,mjs,cjs,vue}',
        'e2e-apps/**/src/**/*.{js,ts,mjs,cjs,vue}',
        'templates/**/src/**/*.{js,ts,mjs,cjs,vue}',
      ],
      rules: {
        'e18e/prefer-object-has-own': 'off',
        'prefer-object-has-own': 'off',
      },
    }, {
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
    }, {
      files: ['@weapp-core/logger/src/index.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    }, {
      files: ['./packages/rolldown-require/**/*.ts'],
      rules: {
        'style/max-statements-per-line': 'off',
        'ts/no-use-before-define': 'off',
        'no-cond-assign': 'off',
        'ts/no-unsafe-function-type': 'off',
      },
    }, {
      files: ['apps/weapp-vite-web-demo/src/**/*.ts'],
      rules: {
        'no-console': 'off',
      },
    }, {
      files: ['package.json'],
      rules: {
        'e18e/ban-dependencies': 'off',
      },
    }, {
      files: ['packages/weapp-vite/package.json'],
      rules: {
        // weapp-vite 的版本兼容公开 API 直接依赖 semver。
        'e18e/ban-dependencies': 'off',
      },
    }, {
      files: ['packages/weapp-ide-cli/package.json'],
      rules: {
        'e18e/ban-dependencies': 'off',
      },
    }, {
      files: ['e2e-apps/request-clients-real/package.json'],
      rules: {
        'e18e/ban-dependencies': 'off',
      },
    }, {
      files: ['packages/miniprogram-automator/src/Element.ts'],
      rules: {
        'ts/no-use-before-define': 'off',
      },
    }, {
      files: ['apps/wevu-vue-demo/src/**/*.vue'],
      rules: {
        'no-console': 'off',
        'ts/no-unused-vars': 'off',
      },
    }, {
      files: ['templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/**/*.{ts,vue,md}'],
      rules: {
        'no-console': 'off',
        'ts/no-use-before-define': 'off',
        'ts/no-unused-vars': 'off',
        'ts/no-redeclare': 'off',
        'ts/no-require-imports': 'off',
        'eqeqeq': 'off',
        'vue/eqeqeq': 'off',
        'vue/valid-v-for': 'off',
        'vue/no-unused-vars': 'off',
        'vue/no-use-v-if-with-v-for': 'off',
        'vue/no-parsing-error': 'off',
        'vue/no-template-shadow': 'off',
        'vue/valid-define-options': 'off',
        'style/max-statements-per-line': 'off',
        'style/no-mixed-operators': 'off',
        'prefer-promise-reject-errors': 'off',
        'regexp/no-useless-quantifier': 'off',
        'unicorn/no-new-array': 'off',
        'unicorn/prefer-number-properties': 'off',
        'jsdoc/check-param-names': 'off',
        'jsdoc/require-returns-description': 'off',
        'eslint-comments/no-unlimited-disable': 'off',
        'markdown/heading-increment': 'off',
        'no-self-assign': 'off',
      },
    }, {
      files: ['skills/*/agents/openai.yaml'],
      rules: {
        'yaml/plain-scalar': 'off',
      },
    }, {
      files: ['**/*.json'],
      rules: {
        'style/eol-last': 'off',
      },
    }, {
      files: ['**/*.test.{ts,js,mjs,cjs}', '**/*.spec.{ts,js,mjs,cjs}'],
      rules: {
        'e18e/prefer-static-regex': 'off',
      },
    }, {
      files: ['packages/miniprogram-automator/src/internal/compat.ts'],
      rules: {
        'e18e/prefer-static-regex': 'off',
      },
    }, {
      files: ['packages/miniprogram-automator/src/internal/compat/strings.ts'],
      rules: {
        'e18e/prefer-static-regex': 'off',
      },
    }],
  },
})
