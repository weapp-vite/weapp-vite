import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    vue: true,
    tailwindcss: true,
    ignores: [
      '**/fixtures/**',
      'website/guide/npm.md',
      'website/guide/json-intelli-sense.md',
      'website/config/index.md',
      'website/snippets',
      '**/*.auto.{js,ts}',
    ],
  },
)
