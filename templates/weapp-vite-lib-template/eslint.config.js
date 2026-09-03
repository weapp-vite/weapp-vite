import { icebreaker } from '@icebreakers/eslint-config'
import { createMiniProgramRuntimeConfig } from '@weapp-vite/eslint'

export default icebreaker({
  miniProgram: true,
  vue: true,
  ignores: ['CHANGELOG.md', 'README.md', '.turbo/**', 'dist/**', 'dist-lib/**', '.weapp-vite/**'],
}, createMiniProgramRuntimeConfig())
