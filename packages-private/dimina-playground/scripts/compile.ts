/* eslint-disable e18e/ban-dependencies -- 子进程隔离上游编译器的环境变量和 worker 缓存。 */
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { appId, examples, root } from '../config'
import { collectAssets } from './assets'
import { preparedRoot } from './preparation'

export async function compileResources() {
  const upstreamRoot = await preparedRoot()
  const { createCompilerContext } = await import('weapp-vite')
  const assets = await collectAssets(path.join(upstreamRoot, 'fe/packages/container-sdk/dist'), 'dimina-sdk/')
  const mittPath = import.meta.resolve('mitt')
  assets.set('vendor/mitt.mjs', await readFile(new URL(mittPath)))
  await mkdir(path.join(root, '.cache'), { recursive: true })
  const stage = await mkdtemp(path.join(root, '.cache/build-'))
  try {
    for (const example of examples) {
      const cwd = path.join(root, 'fixtures', example)
      const outDir = path.join(stage, example, 'weapp')
      const context = await createCompilerContext({
        cwd,
        mode: 'production',
        isDev: false,
        outputRoot: outDir,
        inlineConfig: { build: { outDir, emptyOutDir: false } },
        emitDefaultAutoImportOutputs: false,
        preloadAppEntry: false,
        syncSupportFiles: false,
      })
      await context.buildService.build()
      const artifact = { miniprogramRootPath: context.configService.outDir }
      await cp(path.join(cwd, 'project.config.json'), path.join(artifact.miniprogramRootPath, 'project.config.json'))
      const output = path.join(stage, example, 'dimina')
      await execa(process.execPath, ['--import', 'tsx', path.join(root, 'scripts/dmcc.ts'), output, artifact.miniprogramRootPath], {
        cwd: root,
        env: { ASSETS_PATH_PREFIX: '1', DIMINA_PREPARED_ROOT: upstreamRoot },
        stdio: 'inherit',
      })
      for (const [name, content] of await collectAssets(output, `miniapps/${example}/`)) {
        assets.set(name, content)
      }
      for (const file of ['app-config.json', 'logic.js']) {
        if (!assets.has(`miniapps/${example}/${appId}/main/${file}`)) {
          throw new Error(`Missing ${example}/${file}`)
        }
      }
    }
    return assets
  }
  finally { await rm(stage, { recursive: true, force: true }) }
}
