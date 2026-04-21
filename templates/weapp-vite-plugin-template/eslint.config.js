import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker({
  miniProgram: true,
  ignores: ['CHANGELOG.md', 'README.md', '.turbo/**', 'dist/**', 'dist-plugin/**', '.weapp-vite/**'],
})
