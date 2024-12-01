import { defineWorkspace } from 'vitest/config'

export default defineWorkspace(
  [
    'packages/*',
    '@weapp-core/*',
    'apps/vite-native',
  ],
)
