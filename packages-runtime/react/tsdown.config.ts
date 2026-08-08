import { defineConfig } from 'tsdown'

const entry = {
  index: './src/index.ts',
  renderer: './src/renderer.ts',
  components: './src/components.ts',
  types: './src/types.ts',
}

export default defineConfig([
  {
    entry,
    format: ['esm'],
    target: 'es2018',
    dts: true,
    clean: true,
    minify: true,
    hash: false,
    unbundle: true,
    sourcemap: false,
    failOnWarn: false,
  },
  {
    entry,
    outDir: './dist/dev',
    format: ['esm'],
    target: 'es2018',
    dts: false,
    clean: false,
    minify: false,
    hash: false,
    unbundle: true,
    sourcemap: true,
    failOnWarn: false,
  },
])
