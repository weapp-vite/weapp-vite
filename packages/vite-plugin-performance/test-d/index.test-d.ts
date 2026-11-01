import type { Plugin } from 'vite'
import type { HookExecutionContext, PluginHookName, ResolvedWrapPluginOptions } from 'vite-plugin-performance'
import { expectNotAssignable, expectType } from 'tsd'
import { resolveOptions, wrapPlugin } from 'vite-plugin-performance'

const plugin: Plugin = { name: 'consumer-plugin' }

expectType<Plugin>(wrapPlugin(plugin))
expectType<Plugin[]>(wrapPlugin([plugin]))
expectType<ResolvedWrapPluginOptions>(resolveOptions())
expectNotAssignable<PluginHookName>('missing-hook')

wrapPlugin(plugin, {
  hooks: ['transform', 'resolveId'],
  logger(message, context) {
    expectType<string>(message)
    expectType<HookExecutionContext>(context)
    expectType<PluginHookName>(context.hookName)
  },
})
