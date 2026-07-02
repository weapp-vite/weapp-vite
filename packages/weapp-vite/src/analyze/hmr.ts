import { fs } from '@weapp-core/shared/fs'

export interface HmrProfileJsonSample {
  timestamp?: string
  totalMs?: number
  eventId?: string
  event?: string
  file?: string
  relativeFile?: string
  sourceRootFile?: string
  buildCoreMs?: number
  buildStartMs?: number
  pluginResolveMs?: number
  transformMs?: number
  coreTransformMs?: number
  wevuTransformMs?: number
  vueTransformMs?: number
  vueReadSourceMs?: number
  vueCompileMs?: number
  vueFinalizeCompiledMs?: number
  vueFinalizeCodeMs?: number
  coreLoadMs?: number
  entryLoadMs?: number
  entryCodeReadMs?: number
  entrySidecarResolveMs?: number
  entryJsonReadMs?: number
  entryVueConfigMs?: number
  entryTemplateScanMs?: number
  entryScriptSetupMs?: number
  entryVueSignatureMs?: number
  entryAutoImportMs?: number
  entryPrepareMs?: number
  entryEmitOutputMs?: number
  entryStyleScanMs?: number
  entryStyleReadMs?: number
  entryResolveMs?: number
  entryChunkEmitMs?: number
  entryChunkLoadMs?: number
  entryChunkEmitFileMs?: number
  entryLayoutMs?: number
  requestGlobalsMs?: number
  weapiResolveMs?: number
  renderStartMs?: number
  generateBundleMs?: number
  generateSharedMs?: number
  generateRewriteMs?: number
  generateModuleGraphMs?: number
  writeMs?: number
  watchToDirtyMs?: number
  emitMs?: number
  sharedChunkResolveMs?: number
  chunkEmitCount?: number
  loadCount?: number
  resolveCount?: number
  skippedLoadedCount?: number
  dirtyCount?: number
  pendingCount?: number
  emittedCount?: number
  dirtyReasonSummary?: string[]
  pendingReasonSummary?: string[]
}

export interface HmrProfileMetricSummary {
  count: number
  averageMs?: number
  maxMs?: number
}

export interface HmrProfileOperationSummary {
  count: number
  average?: number
  max?: number
}

export interface HmrProfileCountItem {
  name: string
  count: number
}

export interface HmrProfileAnalyzeResult {
  runtime: 'mini'
  kind: 'hmr-profile'
  generatedAt: string
  profilePath: string
  sampleCount: number
  skippedLineCount: number
  firstTimestamp?: string
  lastTimestamp?: string
  metrics: {
    totalMs: HmrProfileMetricSummary
    buildCoreMs: HmrProfileMetricSummary
    buildStartMs: HmrProfileMetricSummary
    pluginResolveMs: HmrProfileMetricSummary
    transformMs: HmrProfileMetricSummary
    coreTransformMs: HmrProfileMetricSummary
    wevuTransformMs: HmrProfileMetricSummary
    vueTransformMs: HmrProfileMetricSummary
    vueReadSourceMs: HmrProfileMetricSummary
    vueCompileMs: HmrProfileMetricSummary
    vueFinalizeCompiledMs: HmrProfileMetricSummary
    vueFinalizeCodeMs: HmrProfileMetricSummary
    coreLoadMs: HmrProfileMetricSummary
    entryLoadMs: HmrProfileMetricSummary
    entryCodeReadMs: HmrProfileMetricSummary
    entrySidecarResolveMs: HmrProfileMetricSummary
    entryJsonReadMs: HmrProfileMetricSummary
    entryVueConfigMs: HmrProfileMetricSummary
    entryTemplateScanMs: HmrProfileMetricSummary
    entryScriptSetupMs: HmrProfileMetricSummary
    entryVueSignatureMs: HmrProfileMetricSummary
    entryAutoImportMs: HmrProfileMetricSummary
    entryPrepareMs: HmrProfileMetricSummary
    entryEmitOutputMs: HmrProfileMetricSummary
    entryStyleScanMs: HmrProfileMetricSummary
    entryStyleReadMs: HmrProfileMetricSummary
    entryResolveMs: HmrProfileMetricSummary
    entryChunkEmitMs: HmrProfileMetricSummary
    entryChunkLoadMs: HmrProfileMetricSummary
    entryChunkEmitFileMs: HmrProfileMetricSummary
    entryLayoutMs: HmrProfileMetricSummary
    requestGlobalsMs: HmrProfileMetricSummary
    weapiResolveMs: HmrProfileMetricSummary
    renderStartMs: HmrProfileMetricSummary
    generateBundleMs: HmrProfileMetricSummary
    generateSharedMs: HmrProfileMetricSummary
    generateRewriteMs: HmrProfileMetricSummary
    generateModuleGraphMs: HmrProfileMetricSummary
    writeMs: HmrProfileMetricSummary
    watchToDirtyMs: HmrProfileMetricSummary
    emitMs: HmrProfileMetricSummary
    sharedChunkResolveMs: HmrProfileMetricSummary
  }
  operations: {
    chunkEmitCount: HmrProfileOperationSummary
    loadCount: HmrProfileOperationSummary
    resolveCount: HmrProfileOperationSummary
    skippedLoadedCount: HmrProfileOperationSummary
  }
  events: HmrProfileCountItem[]
  dirtyReasons: HmrProfileCountItem[]
  pendingReasons: HmrProfileCountItem[]
  slowestSamples: HmrProfileJsonSample[]
}

interface AnalyzeHmrProfileOptions {
  profilePath: string
  now?: Date
  topSlowest?: number
}

function createMetricSummary(values: number[]): HmrProfileMetricSummary {
  if (!values.length) {
    return {
      count: 0,
    }
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    count: values.length,
    averageMs: total / values.length,
    maxMs: Math.max(...values),
  }
}

function createOperationSummary(values: number[]): HmrProfileOperationSummary {
  if (!values.length) {
    return {
      count: 0,
    }
  }
  const total = values.reduce((sum, value) => sum + value, 0)
  return {
    count: values.length,
    average: total / values.length,
    max: Math.max(...values),
  }
}

function sortCountEntries(map: Map<string, number>) {
  return [...map.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name, count]) => ({ name, count }))
}

function collectCounts(target: Map<string, number>, values?: string[]) {
  for (const value of values ?? []) {
    if (!value) {
      continue
    }
    target.set(value, (target.get(value) ?? 0) + 1)
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/**
 * @description 聚合 HMR JSONL profile，为命令行与后续仪表盘复用。
 */
export async function analyzeHmrProfile(options: AnalyzeHmrProfileOptions): Promise<HmrProfileAnalyzeResult> {
  const content = await fs.readFile(options.profilePath, 'utf8')
  const lines = content.split(/\r?\n/)
  const samples: HmrProfileJsonSample[] = []
  let skippedLineCount = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    try {
      const parsed = JSON.parse(trimmed) as HmrProfileJsonSample
      if (!isFiniteNumber(parsed.totalMs)) {
        skippedLineCount += 1
        continue
      }
      samples.push(parsed)
    }
    catch {
      skippedLineCount += 1
    }
  }

  const eventCounts = new Map<string, number>()
  const dirtyReasonCounts = new Map<string, number>()
  const pendingReasonCounts = new Map<string, number>()
  const totalValues: number[] = []
  const buildCoreValues: number[] = []
  const buildStartValues: number[] = []
  const pluginResolveValues: number[] = []
  const transformValues: number[] = []
  const coreTransformValues: number[] = []
  const wevuTransformValues: number[] = []
  const vueTransformValues: number[] = []
  const vueReadSourceValues: number[] = []
  const vueCompileValues: number[] = []
  const vueFinalizeCompiledValues: number[] = []
  const vueFinalizeCodeValues: number[] = []
  const coreLoadValues: number[] = []
  const entryLoadValues: number[] = []
  const entryCodeReadValues: number[] = []
  const entrySidecarResolveValues: number[] = []
  const entryJsonReadValues: number[] = []
  const entryVueConfigValues: number[] = []
  const entryTemplateScanValues: number[] = []
  const entryScriptSetupValues: number[] = []
  const entryVueSignatureValues: number[] = []
  const entryAutoImportValues: number[] = []
  const entryPrepareValues: number[] = []
  const entryEmitOutputValues: number[] = []
  const entryStyleScanValues: number[] = []
  const entryStyleReadValues: number[] = []
  const entryResolveValues: number[] = []
  const entryChunkEmitValues: number[] = []
  const entryChunkLoadValues: number[] = []
  const entryChunkEmitFileValues: number[] = []
  const entryLayoutValues: number[] = []
  const requestGlobalsValues: number[] = []
  const weapiResolveValues: number[] = []
  const renderStartValues: number[] = []
  const generateBundleValues: number[] = []
  const generateSharedValues: number[] = []
  const generateRewriteValues: number[] = []
  const generateModuleGraphValues: number[] = []
  const writeValues: number[] = []
  const watchToDirtyValues: number[] = []
  const emitValues: number[] = []
  const sharedChunkValues: number[] = []
  const chunkEmitCountValues: number[] = []
  const loadCountValues: number[] = []
  const resolveCountValues: number[] = []
  const skippedLoadedCountValues: number[] = []

  for (const sample of samples) {
    totalValues.push(sample.totalMs!)
    if (sample.event) {
      eventCounts.set(sample.event, (eventCounts.get(sample.event) ?? 0) + 1)
    }
    if (isFiniteNumber(sample.buildCoreMs)) {
      buildCoreValues.push(sample.buildCoreMs)
    }
    if (isFiniteNumber(sample.buildStartMs)) {
      buildStartValues.push(sample.buildStartMs)
    }
    if (isFiniteNumber(sample.pluginResolveMs)) {
      pluginResolveValues.push(sample.pluginResolveMs)
    }
    if (isFiniteNumber(sample.transformMs)) {
      transformValues.push(sample.transformMs)
    }
    if (isFiniteNumber(sample.coreTransformMs)) {
      coreTransformValues.push(sample.coreTransformMs)
    }
    if (isFiniteNumber(sample.wevuTransformMs)) {
      wevuTransformValues.push(sample.wevuTransformMs)
    }
    if (isFiniteNumber(sample.vueTransformMs)) {
      vueTransformValues.push(sample.vueTransformMs)
    }
    if (isFiniteNumber(sample.vueReadSourceMs)) {
      vueReadSourceValues.push(sample.vueReadSourceMs)
    }
    if (isFiniteNumber(sample.vueCompileMs)) {
      vueCompileValues.push(sample.vueCompileMs)
    }
    if (isFiniteNumber(sample.vueFinalizeCompiledMs)) {
      vueFinalizeCompiledValues.push(sample.vueFinalizeCompiledMs)
    }
    if (isFiniteNumber(sample.vueFinalizeCodeMs)) {
      vueFinalizeCodeValues.push(sample.vueFinalizeCodeMs)
    }
    if (isFiniteNumber(sample.coreLoadMs)) {
      coreLoadValues.push(sample.coreLoadMs)
    }
    if (isFiniteNumber(sample.entryLoadMs)) {
      entryLoadValues.push(sample.entryLoadMs)
    }
    if (isFiniteNumber(sample.entryCodeReadMs)) {
      entryCodeReadValues.push(sample.entryCodeReadMs)
    }
    if (isFiniteNumber(sample.entrySidecarResolveMs)) {
      entrySidecarResolveValues.push(sample.entrySidecarResolveMs)
    }
    if (isFiniteNumber(sample.entryJsonReadMs)) {
      entryJsonReadValues.push(sample.entryJsonReadMs)
    }
    if (isFiniteNumber(sample.entryVueConfigMs)) {
      entryVueConfigValues.push(sample.entryVueConfigMs)
    }
    if (isFiniteNumber(sample.entryTemplateScanMs)) {
      entryTemplateScanValues.push(sample.entryTemplateScanMs)
    }
    if (isFiniteNumber(sample.entryScriptSetupMs)) {
      entryScriptSetupValues.push(sample.entryScriptSetupMs)
    }
    if (isFiniteNumber(sample.entryVueSignatureMs)) {
      entryVueSignatureValues.push(sample.entryVueSignatureMs)
    }
    if (isFiniteNumber(sample.entryAutoImportMs)) {
      entryAutoImportValues.push(sample.entryAutoImportMs)
    }
    if (isFiniteNumber(sample.entryPrepareMs)) {
      entryPrepareValues.push(sample.entryPrepareMs)
    }
    if (isFiniteNumber(sample.entryEmitOutputMs)) {
      entryEmitOutputValues.push(sample.entryEmitOutputMs)
    }
    if (isFiniteNumber(sample.entryStyleScanMs)) {
      entryStyleScanValues.push(sample.entryStyleScanMs)
    }
    if (isFiniteNumber(sample.entryStyleReadMs)) {
      entryStyleReadValues.push(sample.entryStyleReadMs)
    }
    if (isFiniteNumber(sample.entryResolveMs)) {
      entryResolveValues.push(sample.entryResolveMs)
    }
    if (isFiniteNumber(sample.entryChunkEmitMs)) {
      entryChunkEmitValues.push(sample.entryChunkEmitMs)
    }
    if (isFiniteNumber(sample.entryChunkLoadMs)) {
      entryChunkLoadValues.push(sample.entryChunkLoadMs)
    }
    if (isFiniteNumber(sample.entryChunkEmitFileMs)) {
      entryChunkEmitFileValues.push(sample.entryChunkEmitFileMs)
    }
    if (isFiniteNumber(sample.entryLayoutMs)) {
      entryLayoutValues.push(sample.entryLayoutMs)
    }
    if (isFiniteNumber(sample.requestGlobalsMs)) {
      requestGlobalsValues.push(sample.requestGlobalsMs)
    }
    if (isFiniteNumber(sample.weapiResolveMs)) {
      weapiResolveValues.push(sample.weapiResolveMs)
    }
    if (isFiniteNumber(sample.renderStartMs)) {
      renderStartValues.push(sample.renderStartMs)
    }
    if (isFiniteNumber(sample.generateBundleMs)) {
      generateBundleValues.push(sample.generateBundleMs)
    }
    if (isFiniteNumber(sample.generateSharedMs)) {
      generateSharedValues.push(sample.generateSharedMs)
    }
    if (isFiniteNumber(sample.generateRewriteMs)) {
      generateRewriteValues.push(sample.generateRewriteMs)
    }
    if (isFiniteNumber(sample.generateModuleGraphMs)) {
      generateModuleGraphValues.push(sample.generateModuleGraphMs)
    }
    if (isFiniteNumber(sample.writeMs)) {
      writeValues.push(sample.writeMs)
    }
    if (isFiniteNumber(sample.watchToDirtyMs)) {
      watchToDirtyValues.push(sample.watchToDirtyMs)
    }
    if (isFiniteNumber(sample.emitMs)) {
      emitValues.push(sample.emitMs)
    }
    if (isFiniteNumber(sample.sharedChunkResolveMs)) {
      sharedChunkValues.push(sample.sharedChunkResolveMs)
    }
    if (isFiniteNumber(sample.chunkEmitCount)) {
      chunkEmitCountValues.push(sample.chunkEmitCount)
    }
    if (isFiniteNumber(sample.loadCount)) {
      loadCountValues.push(sample.loadCount)
    }
    if (isFiniteNumber(sample.resolveCount)) {
      resolveCountValues.push(sample.resolveCount)
    }
    if (isFiniteNumber(sample.skippedLoadedCount)) {
      skippedLoadedCountValues.push(sample.skippedLoadedCount)
    }
    collectCounts(dirtyReasonCounts, sample.dirtyReasonSummary)
    collectCounts(pendingReasonCounts, sample.pendingReasonSummary)
  }

  const orderedByTime = [...samples].sort((left, right) => {
    const leftTime = typeof left.timestamp === 'string' ? Date.parse(left.timestamp) : Number.NaN
    const rightTime = typeof right.timestamp === 'string' ? Date.parse(right.timestamp) : Number.NaN
    if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
      return leftTime - rightTime
    }
    return 0
  })
  const slowestSamples = [...samples]
    .sort((left, right) => (right.totalMs ?? 0) - (left.totalMs ?? 0))
    .slice(0, options.topSlowest ?? 5)

  return {
    runtime: 'mini',
    kind: 'hmr-profile',
    generatedAt: (options.now ?? new Date()).toISOString(),
    profilePath: options.profilePath,
    sampleCount: samples.length,
    skippedLineCount,
    firstTimestamp: orderedByTime[0]?.timestamp,
    lastTimestamp: orderedByTime[orderedByTime.length - 1]?.timestamp,
    metrics: {
      totalMs: createMetricSummary(totalValues),
      buildCoreMs: createMetricSummary(buildCoreValues),
      buildStartMs: createMetricSummary(buildStartValues),
      pluginResolveMs: createMetricSummary(pluginResolveValues),
      transformMs: createMetricSummary(transformValues),
      coreTransformMs: createMetricSummary(coreTransformValues),
      wevuTransformMs: createMetricSummary(wevuTransformValues),
      vueTransformMs: createMetricSummary(vueTransformValues),
      vueReadSourceMs: createMetricSummary(vueReadSourceValues),
      vueCompileMs: createMetricSummary(vueCompileValues),
      vueFinalizeCompiledMs: createMetricSummary(vueFinalizeCompiledValues),
      vueFinalizeCodeMs: createMetricSummary(vueFinalizeCodeValues),
      coreLoadMs: createMetricSummary(coreLoadValues),
      entryLoadMs: createMetricSummary(entryLoadValues),
      entryCodeReadMs: createMetricSummary(entryCodeReadValues),
      entrySidecarResolveMs: createMetricSummary(entrySidecarResolveValues),
      entryJsonReadMs: createMetricSummary(entryJsonReadValues),
      entryVueConfigMs: createMetricSummary(entryVueConfigValues),
      entryTemplateScanMs: createMetricSummary(entryTemplateScanValues),
      entryScriptSetupMs: createMetricSummary(entryScriptSetupValues),
      entryVueSignatureMs: createMetricSummary(entryVueSignatureValues),
      entryAutoImportMs: createMetricSummary(entryAutoImportValues),
      entryPrepareMs: createMetricSummary(entryPrepareValues),
      entryEmitOutputMs: createMetricSummary(entryEmitOutputValues),
      entryStyleScanMs: createMetricSummary(entryStyleScanValues),
      entryStyleReadMs: createMetricSummary(entryStyleReadValues),
      entryResolveMs: createMetricSummary(entryResolveValues),
      entryChunkEmitMs: createMetricSummary(entryChunkEmitValues),
      entryChunkLoadMs: createMetricSummary(entryChunkLoadValues),
      entryChunkEmitFileMs: createMetricSummary(entryChunkEmitFileValues),
      entryLayoutMs: createMetricSummary(entryLayoutValues),
      requestGlobalsMs: createMetricSummary(requestGlobalsValues),
      weapiResolveMs: createMetricSummary(weapiResolveValues),
      renderStartMs: createMetricSummary(renderStartValues),
      generateBundleMs: createMetricSummary(generateBundleValues),
      generateSharedMs: createMetricSummary(generateSharedValues),
      generateRewriteMs: createMetricSummary(generateRewriteValues),
      generateModuleGraphMs: createMetricSummary(generateModuleGraphValues),
      writeMs: createMetricSummary(writeValues),
      watchToDirtyMs: createMetricSummary(watchToDirtyValues),
      emitMs: createMetricSummary(emitValues),
      sharedChunkResolveMs: createMetricSummary(sharedChunkValues),
    },
    operations: {
      chunkEmitCount: createOperationSummary(chunkEmitCountValues),
      loadCount: createOperationSummary(loadCountValues),
      resolveCount: createOperationSummary(resolveCountValues),
      skippedLoadedCount: createOperationSummary(skippedLoadedCountValues),
    },
    events: sortCountEntries(eventCounts),
    dirtyReasons: sortCountEntries(dirtyReasonCounts),
    pendingReasons: sortCountEntries(pendingReasonCounts),
    slowestSamples,
  }
}
