import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    ignores: [
      '**/fixtures/**',
      'website/guide/npm.md',
      'website/guide/json-intelli-sense.md',
      'website/config/index.md',
      '**/*.auto.{js,ts}',
    ],
  },
)
