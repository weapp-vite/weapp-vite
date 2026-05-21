import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: './src/index.ts',
    mcp: './src/mcp.ts',
  },
  dts: true,
  clean: true,
  format: ['esm'],
  outExtensions() {
    return {
      js: '.js',
    }
  },
  target: 'node20',
  failOnWarn: false,
})
