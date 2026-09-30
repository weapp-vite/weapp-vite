import type { Plugin, ViteBuilder } from 'vite'
import type { CompilerContext } from '../../context'

const builders = new WeakMap<CompilerContext, ViteBuilder>()

export function getAppBuilder(ctx: CompilerContext) {
  return builders.get(ctx)
}

/** 所有子目标共享一个宿主登记点，主环境只由该钩子启动一次。 */
export function createAppBuilderPlugin(ctx: CompilerContext): Plugin {
  return {
    name: 'weapp-vite:app-builder',
    async buildApp(builder) {
      builders.set(ctx, builder)
      const main = builder.environments.client
      if (main && !main.isBuilt) {
        await builder.build(main)
      }
    },
  }
}
