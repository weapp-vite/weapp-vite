import { icebreaker } from '@icebreakers/eslint-config'
import { wevuCompatibilityRecommended } from 'weapp-vite/eslint'

export default icebreaker({
  miniProgram: true,
  vue: true,
  tailwindcss: {
    entryPoint: './src/app.css',
  },
  ignores: ['CHANGELOG.md', 'README.md', '.turbo/**', 'dist/**', '.weapp-vite/**'],
}, {
  ...wevuCompatibilityRecommended,
  files: ['src/**/*.{js,jsx,ts,tsx,vue}'],
}, {
  files: ['src/**/*.{ts,vue}'],
  rules: {
    'better-tailwindcss/enforce-canonical-classes': 'off',
    'better-tailwindcss/enforce-consistent-class-order': 'off',
    'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
    'better-tailwindcss/no-conflicting-classes': 'off',
    'better-tailwindcss/no-unknown-classes': 'off',
  },
})
