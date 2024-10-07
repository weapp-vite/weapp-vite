import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker(
  {
    ignores: [
      '**/fixtures/**',
      'website/guide/npm.md',
      '**/*.auto.{js,ts}',
    ],
  },
)
