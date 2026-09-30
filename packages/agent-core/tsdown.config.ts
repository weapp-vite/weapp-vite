import { defineConfig } from 'tsdown'

export default defineConfig({ entry: ['src/index.ts', 'src/project.ts'], format: ['esm'], dts: true, clean: true, target: 'node20' })
