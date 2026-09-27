import { defineConfig } from 'tsdown'

export default defineConfig({ entry: ['./src/types.ts'], format: ['esm'], target: 'es2018', dts: true, clean: true })
