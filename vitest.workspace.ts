import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(
  [
    'packages/*',
    '@weapp-core/*',
    // {
    //   test: {
    //     forceRerunTriggers: ['**/vitest.config.*/**', '**/vite.config.*/**'],
    //   },
    // },
  ],
)
