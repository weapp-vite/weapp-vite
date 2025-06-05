import { defineConfig } from 'vitest/config'

export default defineConfig(
  () => {
    return {
      test: {
        projects: [
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
