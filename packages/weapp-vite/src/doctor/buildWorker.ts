import type { MpPlatform } from '../types'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import process from 'node:process'
import { resolveAnalyzeBudgets } from '../analyze/subpackages/metadata'
import { terminateStaleSassEmbeddedProcess } from '../cli/processCleanup'
import { createCompilerContext } from '../createContext'
import { readDoctorFiles } from './files'

process.once('message', async (options: { cwd: string, configFile?: string, target: MpPlatform }) => {
  try {
    const outputRoot = path.join(options.cwd, '.weapp-vite', 'doctor', options.target, randomUUID())
    const limitations = new Set<string>()
    const ctx = await createCompilerContext({
      cwd: options.cwd,
      configFile: options.configFile,
      cliPlatform: options.target,
      isDev: false,
      mode: 'production',
      outputRoot,
      inlineConfig: {
        build: { outDir: outputRoot, emptyOutDir: true },
        plugins: [{
          name: 'weapp-vite-doctor-output-scope',
          enforce: 'post',
          writeBundle(output) {
            const relative = path.relative(outputRoot, path.resolve(output.dir ?? path.dirname(output.file ?? outputRoot)))
            if (relative.startsWith('..') || path.isAbsolute(relative)) {
              limitations.add('构建器输出包含快照根目录外的路径；不能证明产物覆盖完整。')
            }
          },
        }],
      },
      syncSupportFiles: false,
      preloadAppEntry: false,
      emitDefaultAutoImportOutputs: false,
    })
    if (path.resolve(ctx.configService.outDir) !== outputRoot || ctx.configService.platform !== options.target) {
      throw new Error('实际编译目标或产物目录与 Doctor 请求不一致')
    }
    await ctx.buildService.build()
    if (ctx.configService.weappViteConfig.npm?.buildOptions) {
      limitations.add('自定义 npm.buildOptions 可改变输出目录；当前快照不证明目录外 npm 产物完整。')
    }
    const snapshot = {
      files: await readDoctorFiles(outputRoot),
      origin: 'build',
      freshness: 'current-build',
      capturedAt: new Date().toISOString(),
      budgets: resolveAnalyzeBudgets(ctx.configService),
      sourceRoot: path.relative(options.cwd, ctx.configService.absoluteSrcRoot).split(path.sep).join('/'),
      outputRoot: path.relative(options.cwd, outputRoot).split(path.sep).join('/'),
      limitations: [...limitations],
    }
    terminateStaleSassEmbeddedProcess()
    process.send?.({ snapshot }, () => process.exit(0))
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    terminateStaleSassEmbeddedProcess()
    process.exit(2)
  }
})
