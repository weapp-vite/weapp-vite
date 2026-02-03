import process from 'node:process'
import { defineConfig } from 'weapp-vite/config'

type SharedStrategy = 'duplicate' | 'hoist'
type SharedMode = 'common' | 'path' | 'inline'
type DynamicImports = 'preserve' | 'inline'

type OverrideName = 'none' | 'path' | 'inline' | 'mixed'

const overridesByName: Record<OverrideName, { test: string | RegExp, mode: SharedMode }[]> = {
  none: [],
  path: [{ test: 'shared/path-only.ts', mode: 'path' }],
  inline: [{ test: /shared\/inline-only\.ts$/, mode: 'inline' }],
  mixed: [
    { test: 'shared/path-only.ts', mode: 'path' },
    { test: /shared\/inline-only\.ts$/, mode: 'inline' },
  ],
}

const sharedStrategy = (process.env.WEAPP_CHUNK_STRATEGY as SharedStrategy | undefined) ?? 'duplicate'
const sharedMode = (process.env.WEAPP_CHUNK_MODE as SharedMode | undefined) ?? 'common'
const dynamicImports = (process.env.WEAPP_CHUNK_DYNAMIC as DynamicImports | undefined) ?? 'preserve'
const overrideName = (process.env.WEAPP_CHUNK_OVERRIDE as OverrideName | undefined) ?? 'none'
const outDir = process.env.WEAPP_CHUNK_OUTDIR ?? 'dist'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    chunks: {
      sharedStrategy,
      sharedMode,
      sharedOverrides: overridesByName[overrideName] ?? [],
      sharedPathRoot: 'src',
      dynamicImports,
    },
    worker: {
      entry: ['index'],
    },
    npm: {
      enable: false,
    },
  },
  build: {
    outDir,
    minify: false,
  },
})
