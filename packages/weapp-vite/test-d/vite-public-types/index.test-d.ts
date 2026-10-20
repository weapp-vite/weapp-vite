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

defineConfig({ plugins: [weapp()], weapp: { platform: 'web' } })

// 构建配置不得把小程序模板标签合入原生 DOM 元素表。
declare const tags: HTMLElementTagNameMap
expectType<HTMLCanvasElement>(tags.canvas)
expectType<HTMLMapElement>(tags.map)
expectType<HTMLImageElement>(tags.img)
// @ts-expect-error 配置入口不得引入小程序宿主全局声明。
void wx
// @ts-expect-error 配置入口不得引入小程序宿主全局声明。
void my
// @ts-expect-error 配置入口不得引入小程序宿主全局声明。
void tt
