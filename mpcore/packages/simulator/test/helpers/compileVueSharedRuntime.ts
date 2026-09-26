import type { InputOptions } from 'rolldown'
import path from 'node:path'
import { rolldown } from 'rolldown'

async function generate(options: InputOptions) {
  const bundle = await rolldown(options)
  try {
    const { output } = await bundle.generate({ format: 'cjs' })
    if (output.length !== 1 || output[0]?.type !== 'chunk') {
      throw new Error('Expected one compiled Vue fixture chunk')
    }
    return { code: output[0].code }
  }
  finally {
    await bundle.close()
  }
}

/** 为微信宿主 fixture 单独构建静态 runtime，不读取其他应用的生成配置。 */
export async function compileVueSharedRuntime(repoRoot: string, withRouter = false, pageHooks = false) {
  return generate({
    cwd: repoRoot,
    tsconfig: false,
    transform: { define: {
      'import.meta.env.PLATFORM': '"weapp"',
      'import.meta': JSON.stringify({ env: { PLATFORM: 'weapp' } }),
    } },
    input: 'virtual:vue-shared-runtime',
    plugins: [{
      name: 'shared-wevu-fixture-runtime',
      resolveId: id => id === 'virtual:vue-shared-runtime' ? id : undefined,
      load(id) {
        if (id === 'virtual:vue-shared-runtime') {
          return [
            `export { createApp, createWevuComponent, installInlineEvents } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/internal-runtime.ts'))};`,
            `export { ref, computed } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/internal-reactivity.ts'))};`,
            `export { nextTick } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/scheduler.ts'))};`,
            ...(pageHooks ? [`export { onLoad, onMounted } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/internal-runtime.ts'))};`] : []),
            ...(withRouter ? [`export { createRouter, useRouter } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/router.ts'))};`] : []),
          ].join('\n')
        }
      },
    }],
  })
}
