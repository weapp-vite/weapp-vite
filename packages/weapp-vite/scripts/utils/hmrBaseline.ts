import type * as WevuCompiler from 'wevu/compiler'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

interface PackageManifest {
  name?: string
  version?: string
  exports?: Record<string, unknown>
  dependencies?: Record<string, string>
}

function resolveImportExport(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [condition, target] of Object.entries(value)) {
      if (['node', 'import', 'default'].includes(condition)) {
        const resolved = resolveImportExport(target)
        if (resolved) {
          return resolved
        }
      }
    }
  }
}

async function requireCheckoutPath(root: string, candidate: string) {
  const resolved = await realpath(candidate)
  const relative = path.relative(root, resolved)
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('Auto-import HMR reference compiler must belong to the measured checkout')
  }
  return { absolute: resolved, relative: relative.split(path.sep).join('/') }
}

/** 从被测 checkout 的公开入口解析编译器；拒绝误用驱动 checkout 或外部链接。 */
export async function resolveAutoImportHmrCompiler(workspaceRoot: string, weappViteDir: string) {
  const root = await realpath(workspaceRoot)
  const packageRoot = await requireCheckoutPath(root, path.join(weappViteDir, 'node_modules/wevu'))
  const manifest = JSON.parse(await readFile(path.join(packageRoot.absolute, 'package.json'), 'utf8')) as PackageManifest
  const exported = resolveImportExport(manifest.exports?.['./compiler'])
  if (manifest.name !== 'wevu' || !manifest.version || !exported?.startsWith('./')) {
    throw new Error('Measured checkout does not expose the public wevu/compiler entry')
  }
  const entry = await requireCheckoutPath(root, path.resolve(packageRoot.absolute, exported))
  const implementation = manifest.dependencies?.['@wevu/compiler']
    ? await requireCheckoutPath(root, path.join(packageRoot.absolute, 'node_modules/@wevu/compiler'))
    : undefined
  const loaded = await import(pathToFileURL(entry.absolute).href) as typeof WevuCompiler
  if (typeof loaded.compileVueFile !== 'function' || typeof loaded.getMiniProgramTemplatePlatform !== 'function') {
    throw new TypeError('Measured wevu/compiler is missing its public SFC compilation API')
  }
  return {
    compiler: loaded,
    identity: {
      package: 'wevu/compiler',
      version: manifest.version,
      entry: entry.relative,
      ...(implementation ? { implementation: implementation.relative } : {}),
    },
  }
}

/** 首次修改前冻结两种模式的完整参考，并用真实初始产物验证编译选项。 */
export async function prepareAutoImportHmrBaselines(options: {
  workspaceRoot: string
  weappViteDir: string
  source: string
  filename: string
  initialOutput: string
  initialRuntime: 'stateful-experimental' | 'classic'
}) {
  const startedAt = performance.now()
  const { compiler, identity } = await resolveAutoImportHmrCompiler(options.workspaceRoot, options.weappViteDir)
  const compile = async (stabilizeCssVarsRuntime: boolean) => {
    const result = await compiler.compileVueFile(options.source, options.filename, {
      isPage: true,
      stabilizeCssVarsRuntime,
      template: {
        platform: compiler.getMiniProgramTemplatePlatform('weapp'),
        formatWxml: true,
        preserveComments: true,
      },
    })
    if (typeof result.template !== 'string' || !result.template.trim()) {
      throw new Error('Auto-import HMR reference compiler did not return a complete template')
    }
    return result.template
  }
  const initial = await compile(options.initialRuntime === 'stateful-experimental')
  if (initial !== options.initialOutput) {
    throw new Error('Auto-import HMR reference compiler does not exactly reproduce the initial emitted template')
  }
  const classic = options.initialRuntime === 'classic' ? initial : await compile(false)
  const fingerprint = (source: string) => ({ sha256: createHash('sha256').update(source).digest('hex'), bytes: Buffer.byteLength(source) })
  return {
    initial,
    classic,
    evidence: {
      source: fingerprint(options.source),
      initial: { runtime: options.initialRuntime, ...fingerprint(initial) },
      classic: { runtime: 'classic', ...fingerprint(classic) },
      compiler: identity,
      initialOutputExactlyVerified: true,
      frozenBeforeFirstMutation: true,
      preparationMs: performance.now() - startedAt,
    },
  }
}
