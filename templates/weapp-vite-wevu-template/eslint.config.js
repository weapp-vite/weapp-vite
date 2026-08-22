import { icebreaker } from '@icebreakers/eslint-config'
import { wevuCompatibilityRecommended } from '@weapp-vite/eslint'

export default icebreaker({
  miniProgram: true,
  vue: true,
  ignores: ['CHANGELOG.md', 'README.md', '.turbo/**', 'dist/**', '.weapp-vite/**'],
}, {
  ...wevuCompatibilityRecommended,
  files: ['src/**/*.{js,jsx,ts,tsx,vue}'],
})
