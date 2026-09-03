import { icebreaker } from '@icebreakers/eslint-config'
import { createMiniProgramRuntimeConfig } from '@weapp-vite/eslint'

export default icebreaker({
  miniProgram: true,
  vue: true,
  ignores: ['CHANGELOG.md', 'README.md', '.turbo/**', 'dist/**', '.weapp-vite/**'],
}, createMiniProgramRuntimeConfig())
