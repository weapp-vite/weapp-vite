import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 使用安装后 TypeScript 的跨平台进程执行。
import { execa } from 'execa'

/** 类型探针只编译公开 consumer，不调用 watcher，也不读取仓库 tsconfig。 */
export async function verifyPublicTypes(consumerRoot, env) {
  const source = `import { defineConfig } from 'weapp-vite'
import { weapp } from 'weapp-vite/vite'
import { buildTestArtifact, isTestArtifactCurrent, watchTestArtifact } from 'weapp-vite/test'
import type { WatchTestArtifactOptions, WeappViteTestArtifact, WeappViteTestArtifactWatcher } from 'weapp-vite/test'

const options: WatchTestArtifactOptions = {
  cwd: '.',
  outDir: '.weapp-vite/type-only',
  onError(error) { const unknownError: unknown = error; void unknownError },
  async onRebuilt(artifact) { const filename: string = artifact.appConfigPath; void filename },
}
const built: Promise<WeappViteTestArtifact> = buildTestArtifact(options)
const watched: Promise<WeappViteTestArtifactWatcher> = watchTestArtifact(options)
declare const watcher: WeappViteTestArtifactWatcher
const closing: Promise<void> = watcher.close()
const rebuilt: Promise<WeappViteTestArtifact> = watcher.rebuild()
const current: Promise<boolean> = isTestArtifactCurrent(watcher.artifact)
const output: string = watcher.artifact.miniprogramRootPath
const plugins = weapp()
const config = defineConfig({ weapp: { platform: 'weapp', srcRoot: 'src', hmr: { runtime: 'classic' } } })
// @ts-expect-error 公开 close 不接受额外参数。
watcher.close('invalid')
// @ts-expect-error 公开插件工厂不接受私有 watcher 选项。
weapp({ watcher: true })
// @ts-expect-error cwd 必须是路径字符串。
const invalidPath: WatchTestArtifactOptions = { cwd: 1 }
// @ts-expect-error onRebuilt 接受公开 artifact，不接受数字。
const invalidCallback: WatchTestArtifactOptions = { onRebuilt: (_artifact: number) => {} }
void [built, watched, closing, rebuilt, current, output, plugins, config, invalidPath, invalidCallback]
`
  await writeFile(path.join(consumerRoot, 'public-contract.mts'), source)
  await writeFile(path.join(consumerRoot, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: { target: 'ES2022', lib: ['ES2022', 'DOM'], module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: false, types: ['node'] },
    files: ['public-contract.mts'],
  }, null, 2)}\n`)
  const execution = await execa(process.execPath, [path.join(consumerRoot, 'node_modules/typescript/bin/tsc'), '--project', 'tsconfig.json'], { cwd: consumerRoot, env, timeout: 120_000 })
  return { status: 'passed', compiler: 'installed-typescript', version: '6.0.3', strict: true, skipLibCheck: false, stdout: execution.stdout, stderr: execution.stderr }
}
