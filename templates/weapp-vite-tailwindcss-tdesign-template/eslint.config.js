import { icebreaker } from '@icebreakers/eslint-config'
import { createMiniProgramRuntimeConfig } from '@weapp-vite/eslint'

export default icebreaker({
  miniProgram: true,
  tailwindcss: {
    entryPoint: './src/app.css',
  },
  ignores: ['CHANGELOG.md', 'README.md', '.turbo/**', 'dist/**', '.weapp-vite/**'],
}, createMiniProgramRuntimeConfig())
