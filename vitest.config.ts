import { defineConfig } from 'vitest/config'

export default defineConfig(
  () => {
    return {
      test: {
        workspace: [
          'packages/*',
          '@weapp-core/*',
          'apps/vite-native',
        ],
        coverage: {
          enabled: true,
          all: false,
          skipFull: true,
        },
      },
    }
  },
)
