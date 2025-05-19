import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    vue: true,
    tailwindcss: true,
    ignores: [
      '**/fixtures/**',
      'website/guide/npm.md',
      'website/guide/wxs.md',
      'website/guide/json-intelli-sense.md',
      'website/config/index.md',
      'website/snippets',
      '**/*.auto.{js,ts}',
      'website/blog/release1_7.md',
      'node_modules/**',
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
)
