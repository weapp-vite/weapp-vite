import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker({
  miniProgram: true,
  vue: true,
  ignores: ['dist/**', '.weapp-vite/**'],
})
