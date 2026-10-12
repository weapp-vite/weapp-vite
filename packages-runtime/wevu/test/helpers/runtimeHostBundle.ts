import path from 'node:path'
import { rolldown } from 'rolldown'

export async function createRuntimeHostBundle(
  platform: 'weapp' | 'alipay' | 'tt',
  packageRoot = path.resolve(import.meta.dirname, '../..'),
): Promise<string> {
  const entry = 'virtual:runtime-host'
  const bundle = await rolldown({
    cwd: packageRoot,
    input: entry,
    platform: 'neutral',
    // 限定所属包配置，避免遍历根项目引用并依赖无关 app 的生成文件。
    tsconfig: path.join(packageRoot, 'tsconfig.json'),
    transform: { define: { 'import.meta': JSON.stringify({ env: { PLATFORM: platform } }) } },
    plugins: [{
      name: 'runtime-host-test',
      resolveId: id => id === entry ? id : undefined,
      load: id => id === entry
        ? [
            `export * from ${JSON.stringify(path.join(packageRoot, 'src/runtime/platform.ts'))}`,
            `export * from ${JSON.stringify(path.join(packageRoot, 'src/runtime/hooks/base.ts'))}`,
            `export { createRouter, useRouter } from ${JSON.stringify(path.join(packageRoot, 'src/router.ts'))}`,
          ].join('\n')
        : undefined,
    }],
  })
  try {
    const result = await bundle.generate({ format: 'cjs' })
    const chunk = result.output.find(item => item.type === 'chunk')
    if (!chunk || chunk.type !== 'chunk') {
      throw new Error('Missing runtime host test bundle')
    }
    return chunk.code
  }
  finally {
    await bundle.close()
  }
}
