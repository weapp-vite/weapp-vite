import type { WeappViteConfig } from 'weapp-vite/config'
import { expectAssignable, expectError } from 'tsd'
import { defineConfig } from 'weapp-vite'

const options = {
  projects: ['tsconfig.app.json'],
  projectDiscovery: 'lazy' as const,
  parseNative: true,
  importerFilter: (id: string) => id.endsWith('.vue'),
}
expectAssignable<WeappViteConfig['tsconfigPaths']>(options)
defineConfig({ weapp: { tsconfigPaths: options } })
expectError(defineConfig({ weapp: { tsconfigPaths: { parseNative: 'yes' } } }))
expectError(defineConfig({ weapp: { tsconfigPaths: { projectDiscovery: 'unknown' } } }))
