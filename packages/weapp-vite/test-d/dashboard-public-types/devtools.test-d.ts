import type { KitNodeContext } from '@vitejs/devtools-kit/node'
import type { Plugin, ResolvedConfig } from 'vite'
import type { AnalyzeDashboardDevframeController } from 'weapp-vite/dashboard'
import { createPluginFromDevframe } from '@vitejs/devtools-kit/node'
import { expectAssignable, expectType } from 'tsd'
import { createAnalyzeDashboardPlugin } from 'weapp-vite/dashboard/vite'

declare const controller: AnalyzeDashboardDevframeController
declare const kitContext: KitNodeContext
declare const viteConfig: ResolvedConfig

expectAssignable<Plugin>(createPluginFromDevframe(controller.definition))
expectType<void | Promise<void>>(createAnalyzeDashboardPlugin(controller).devtools!.setup({
  ...kitContext,
  viteConfig,
}))
