import { defineConfig } from 'tsdown'

export default defineConfig({ entry: ['src/index.ts'], format: ['esm'], dts: false, clean: true, target: 'node24', deps: { alwaysBundle: [/^@weapp-agent\//] }, banner: '#!/usr/bin/env node' })
