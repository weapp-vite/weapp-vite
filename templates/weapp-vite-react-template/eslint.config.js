import { icebreaker } from '@icebreakers/eslint-config'
import { createMiniProgramRuntimeConfig } from '@weapp-vite/eslint'

export default icebreaker({
  miniProgram: true,
  ignores: ['dist/**', '.weapp-vite/**'],
}, createMiniProgramRuntimeConfig())
