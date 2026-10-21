import type { EmittedAsset, OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import type { CompilerContext } from '../../context'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { WEAPP_VITE_CLASSIC_GENERATION_MARKER } from '@weapp-core/constants'
import path from 'pathe'
import { isBundlerDiagnosticAsset } from '../../runtime/buildPlugin/outputBoundary'
import { resolveHmrRuntimeDecision } from '../../runtime/hmrRuntime'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
import { editOutputChunkCode, resolveOutputChunkTransformCode } from '../../utils/outputChunk'

type GenerationOutput = OutputAsset | OutputChunk | EmittedAsset

interface ClassicGenerationOptions {
  partial: boolean
  independentOutputs: Iterable<GenerationOutput>
  independentOutputNames: Iterable<string>
  publicOutputs: Iterable<EmittedAsset>
}

const generationPattern = new RegExp(`\\n?;void "${WEAPP_VITE_CLASSIC_GENERATION_MARKER}:[a-f0-9]{64}";\\n?`, 'g')

/** 只对实际 classic 的微信主应用安装原生发布标记。 */
export function shouldPublishClassicGeneration(ctx: CompilerContext) {
  const service = ctx.configService
  if (!service.isDev || service.platform !== 'weapp' || service.pluginOnly
    || service.weappLibConfig?.enabled || (ctx.currentBuildTarget ?? 'app') !== 'app') {
    return false
  }
  return getHmrRuntimeSession(ctx).resolve(resolveHmrRuntimeDecision({
    platform: service.platform,
    configured: service.weappViteConfig?.hmr?.runtime,
    compileHotReLoad: service.projectPrivateConfig?.setting?.compileHotReLoad,
  })).runtime === 'classic'
}

function withoutGeneration(code: string) {
  return code.replace(generationPattern, '')
}

function outputFingerprint(output: GenerationOutput) {
  if (output.type === 'chunk' || output.fileName?.endsWith('.js')) {
    const code = output.type === 'chunk'
      ? output.code
      : typeof output.source === 'string' ? output.source : Buffer.from(output.source ?? []).toString('utf8')
    const source = resolveOutputChunkTransformCode({ code } as OutputChunk)
    return createHash('sha256').update(output.fileName === 'app.js' ? withoutGeneration(source) : source).digest('hex')
  }
  return createHash('sha256').update(output.source ?? '').digest('hex')
}

function sourceMapNames(outputs: GenerationOutput[]) {
  const names = new Set<string>()
  for (const output of outputs) {
    if (output.type !== 'chunk' && !output.fileName?.endsWith('.js')) {
      continue
    }
    if (output.type === 'chunk' && (output.sourcemapFileName || output.map)) {
      names.add((output.sourcemapFileName ?? `${output.fileName}.map`).replaceAll('\\', '/'))
    }
    const code = output.type === 'chunk'
      ? output.code
      : typeof output.source === 'string' ? output.source : Buffer.from(output.source ?? []).toString('utf8')
    const references = code.matchAll(/\/\/[#@]\s*sourceMappingURL=(\S+)/g)
    for (const reference of references) {
      const target = reference[1]
      if (!target.startsWith('data:') && !target.includes('://') && !target.startsWith('/')) {
        names.add(path.join(path.dirname(output.fileName!), target.replaceAll('\\', '/')))
      }
    }
  }
  return names
}

function collectFingerprints(outputs: Iterable<GenerationOutput>, generated = true) {
  const items = [...outputs]
  const sourceMaps = generated ? sourceMapNames(items) : new Set<string>()
  const fingerprints = new Map<string, string>()
  for (const output of items) {
    const fileName = output.fileName?.replaceAll('\\', '/')
    // 映射包含 app.js 的 sourcesContent，不能反过来成为其发布标记的输入。
    if (!fileName || sourceMaps.has(fileName) || isBundlerDiagnosticAsset(output as OutputAsset)) {
      continue
    }
    fingerprints.set(fileName, outputFingerprint(output))
  }
  return fingerprints
}

/** 聚合已发布视图与本轮原生输出，返回仅在完整写入成功后调用的提交函数。 */
export function prepareClassicOutputGeneration(
  ctx: CompilerContext,
  outDir: string,
  bundle: OutputBundle,
  options: ClassicGenerationOptions,
) {
  const app = bundle['app.js']
  if (app?.type !== 'chunk' || !app.isEntry) {
    throw new Error('[weapp-vite] classic 原生发布缺少 app.js 根入口，无法保证完整重载。')
  }
  const session = getHmrRuntimeSession(ctx)
  const root = path.resolve(outDir)
  const previous = session.outputGenerations.get(root)
  const compiled = new Map(options.partial ? previous?.scopes.get('compiled') : undefined)
  for (const [file, fingerprint] of collectFingerprints(Object.values(bundle))) {
    compiled.set(file, fingerprint)
  }
  const independentNames = new Set([...options.independentOutputNames].map(file => file.replaceAll('\\', '/')))
  const independent = new Map([...previous?.scopes.get('independent') ?? []].filter(([file]) => independentNames.has(file)))
  for (const [file, fingerprint] of collectFingerprints(options.independentOutputs)) {
    if (independentNames.has(file)) {
      independent.set(file, fingerprint)
    }
  }
  const scopes = new Map([
    ['compiled', compiled],
    ['independent', independent],
    ['public', collectFingerprints(options.publicOutputs, false)],
  ])
  const contents = [...scopes].map(([scope, files]) => [scope, [...files].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)])
  const fingerprint = createHash('sha256').update(JSON.stringify(contents)).digest('hex')
  const marker = `\n;void "${WEAPP_VITE_CLASSIC_GENERATION_MARKER}:${fingerprint}";\n`
  // 编辑原生 chunk，继续由 bundler 写出；不复用磁盘上的旧 app.js，也不追加第二个 marker。
  editOutputChunkCode(app, (code) => {
    for (const match of app.code.matchAll(generationPattern)) {
      code.remove(match.index!, match.index! + match[0].length)
    }
    code.append(marker)
  })
  return () => session.outputGenerations.set(root, { fingerprint, scopes })
}
