import { icebreaker } from '@icebreakers/eslint-config'

export default icebreaker({
  miniProgram: true,
  ignores: ['dist/**', '.weapp-vite/**'],
})
