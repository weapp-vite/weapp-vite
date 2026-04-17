import path from 'node:path'
import { defineConfig } from 'tsdown'

export default defineConfig({
  alias: {
    '@weapp-core/shared': path.resolve(import.meta.dirname, '../../@weapp-core/shared/src/index.ts'),
    '@weapp-core/shared/node': path.resolve(import.meta.dirname, '../../@weapp-core/shared/src/node.ts'),
    '@weapp-core/shared/fs': path.resolve(import.meta.dirname, '../../@weapp-core/shared/src/fs/index.ts'),
  },
  entry: ['./src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node18',
  failOnWarn: false,
})
