import type { Plugin } from 'vite'
import { expectError, expectType } from 'tsd'
import { defineConfig } from 'vite'
import { weapp } from 'weapp-vite/vite'

expectType<Plugin[]>(weapp())
expectError(weapp({ platform: 'weapp' }))
defineConfig({ plugins: [weapp()], weapp: { platform: 'weapp', srcRoot: 'src' } })
defineConfig(() => ({ plugins: [weapp()], weapp: { platform: 'weapp' } }))
defineConfig(async () => ({ plugins: [weapp()], weapp: { platform: 'weapp' } }))
expectError(defineConfig({ plugins: [weapp()], weapp: { platform: 'invalid-platform' } }))
expectError(defineConfig({ plugins: [weapp()], weapp: { srcRot: 'src' } }))
