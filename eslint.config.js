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
      },
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
)
