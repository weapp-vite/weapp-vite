import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker({
  miniProgram: true,
  vue: true,
  ignores: ['CHANGELOG.md', 'README.md', 'dist-lib/**', '.turbo/**'],
})
