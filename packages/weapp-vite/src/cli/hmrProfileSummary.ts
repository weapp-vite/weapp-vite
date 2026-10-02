import type { HmrProfileJsonSample } from '../analyze/hmr'
import type { WeappViteConfig } from '../types'
import { fs } from '@weapp-core/shared/fs'
import { readHmrProfileLines } from '../analyze/hmr/reader'
import { resolveHmrProfileJsonPath } from '../utils/hmrProfile'

export interface HmrLatestProfileSummary {
  file?: string
  line: string
  profilePath: string
}

interface ReadLatestHmrProfileSummaryOptions {
  cwd: string
  relativeCwd?: (value: string) => string
  weappViteConfig?: WeappViteConfig
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatPhaseHint(sample: HmrProfileJsonSample) {
  const phases = [
    {
      label: 'build-core',
      value: sample.buildCoreMs,
    },
    {
      label: 'transform',
      value: sample.transformMs,
    },
    {
      label: 'build-start',
      value: sample.buildStartMs,
    },
    {
      label: 'plugin-resolve',
      value: sample.pluginResolveMs,
    },
    {
      label: 'core-transform',
      value: sample.coreTransformMs,
    },
    {
      label: 'wevu-transform',
      value: sample.wevuTransformMs,
    },
    {
      label: 'vue-transform',
      value: sample.vueTransformMs,
    },
    {
      label: 'vue-read',
      value: sample.vueReadSourceMs,
    },
    {
      label: 'vue-compile',
      value: sample.vueCompileMs,
    },
    {
      label: 'vue-finalize-compiled',
      value: sample.vueFinalizeCompiledMs,
    },
    {
      label: 'vue-finalize-code',
      value: sample.vueFinalizeCodeMs,
    },
    {
      label: 'core-load',
      value: sample.coreLoadMs,
    },
    {
      label: 'entry-load',
      value: sample.entryLoadMs,
    },
    {
      label: 'entry-emit-output',
      value: sample.entryEmitOutputMs,
    },
    {
      label: 'entry-template-scan',
      value: sample.entryTemplateScanMs,
    },
    {
      label: 'entry-auto-import',
      value: sample.entryAutoImportMs,
    },
    {
      label: 'entry-script-setup',
      value: sample.entryScriptSetupMs,
    },
    {
      label: 'entry-vue-signature',
      value: sample.entryVueSignatureMs,
    },
    {
      label: 'entry-sidecar-resolve',
      value: sample.entrySidecarResolveMs,
    },
    {
      label: 'entry-json-read',
      value: sample.entryJsonReadMs,
    },
    {
      label: 'entry-vue-config',
      value: sample.entryVueConfigMs,
    },
    {
      label: 'entry-prepare',
      value: sample.entryPrepareMs,
    },
    {
      label: 'entry-resolve',
      value: sample.entryResolveMs,
    },
    {
      label: 'entry-style-scan',
      value: sample.entryStyleScanMs,
    },
    {
      label: 'entry-style-read',
      value: sample.entryStyleReadMs,
    },
    {
      label: 'entry-code-read',
      value: sample.entryCodeReadMs,
    },
    {
      label: 'entry-chunk-emit',
      value: sample.entryChunkEmitMs,
    },
    {
      label: 'entry-chunk-load',
      value: sample.entryChunkLoadMs,
    },
    {
      label: 'entry-chunk-emit-file',
      value: sample.entryChunkEmitFileMs,
    },
    {
      label: 'entry-layout',
      value: sample.entryLayoutMs,
    },
    {
      label: 'request-globals',
      value: sample.requestGlobalsMs,
    },
    {
      label: 'weapi-resolve',
      value: sample.weapiResolveMs,
    },
    {
      label: 'render-start',
      value: sample.renderStartMs,
    },
    {
      label: 'generate',
      value: sample.generateBundleMs,
    },
    {
      label: 'generate-shared',
      value: sample.generateSharedMs,
    },
    {
      label: 'generate-rewrite',
      value: sample.generateRewriteMs,
    },
    {
      label: 'module-graph',
      value: sample.generateModuleGraphMs,
    },
    {
      label: 'snapshot-resolve',
      value: sample.snapshotResolveMs,
    },
    {
      label: 'snapshot-build',
      value: sample.snapshotBuildMs,
    },
    {
      label: 'watch->dirty',
      value: sample.watchToDirtyMs,
    },
    {
      label: 'emit',
      value: sample.emitMs,
    },
    {
      label: 'shared',
      value: sample.sharedChunkResolveMs,
    },
    {
      label: 'write',
      value: sample.writeMs,
    },
  ]
    .filter(phase => isFiniteNumber(phase.value))
    .sort((left, right) => (right.value ?? 0) - (left.value ?? 0))

  const topPhase = phases[0]
  if (!topPhase || (topPhase.value ?? 0) < 5) {
    return undefined
  }
  return `${topPhase.label} ${topPhase.value!.toFixed(2)} ms`
}

/**
 * @description 读取最近一次 HMR profile，并格式化为 IDE 日志启动前的单行摘要。
 */
export async function readLatestHmrProfileSummary(
  options: ReadLatestHmrProfileSummaryOptions,
): Promise<HmrLatestProfileSummary | undefined> {
  const profilePath = resolveHmrProfileJsonPath({
    cwd: options.cwd,
    option: options.weappViteConfig?.hmr?.profileJson,
  })
  if (!profilePath) {
    return undefined
  }

  const content = await fs.readFile(profilePath, 'utf8').catch(() => undefined)
  if (!content) {
    return undefined
  }

  const { samples, skippedLineCount } = readHmrProfileLines(content)
  const sample = samples.at(-1)
  if (!sample || !isFiniteNumber(sample.totalMs)) {
    return undefined
  }

  const relativeCwd = options.relativeCwd ?? (value => value)
  const segments = [
    `[hmr] 最近一次热更新 ${sample.totalMs.toFixed(2)} ms`,
  ]
  if (sample.event) {
    segments.push(sample.event)
  }
  if (sample.file) {
    segments.push(relativeCwd(sample.file))
  }
  const phaseHint = formatPhaseHint(sample)
  if (phaseHint) {
    segments.push(`主耗时 ${phaseHint}`)
  }
  if (
    isFiniteNumber(sample.loadCount)
    || isFiniteNumber(sample.resolveCount)
    || isFiniteNumber(sample.chunkEmitCount)
    || isFiniteNumber(sample.skippedLoadedCount)
  ) {
    segments.push(`load/resolve/chunk/skip ${sample.loadCount ?? 'unknown'}/${sample.resolveCount ?? 'unknown'}/${sample.chunkEmitCount ?? 'unknown'}/${sample.skippedLoadedCount ?? 'unknown'}`)
  }

  if (skippedLineCount) {
    segments.push(`忽略 ${skippedLineCount} 条不兼容、未完成或无效记录`)
  }

  return {
    file: sample.file,
    profilePath,
    line: segments.join('，'),
  }
}
