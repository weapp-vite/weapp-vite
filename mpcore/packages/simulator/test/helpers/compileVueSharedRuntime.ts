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

/** 单独构建测试 runtime，不读取仓库中其他应用的生成配置。 */
export async function compileVueSharedRuntime(repoRoot: string) {
  return generate({
    cwd: repoRoot,
    tsconfig: false,
    input: 'virtual:vue-shared-runtime',
    plugins: [{
      name: 'shared-wevu-fixture-runtime',
      resolveId: id => id === 'virtual:vue-shared-runtime' ? id : undefined,
      load(id) {
        if (id === 'virtual:vue-shared-runtime') {
          return [
            `export { createWevuComponent, installInlineEvents } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/internal-runtime.ts'))};`,
            `export { ref } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/internal-reactivity.ts'))};`,
            `export { nextTick } from ${JSON.stringify(path.join(repoRoot, 'packages-runtime/wevu/src/scheduler.ts'))};`,
          ].join('\n')
        }
      },
    }],
  })
}
