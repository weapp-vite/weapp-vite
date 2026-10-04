/* eslint-disable ts/no-use-before-define */
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import {
  WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE,
  WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY,
  WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE,
  WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE,
} from '@weapp-core/constants'
import path from 'pathe'
import { snapshotBenchmarkOutputs } from '../../../../scripts/benchmarkTemplatesHmr/outputScope'
import { parseStatefulHmrControlSource } from '../../../../scripts/workspace-hmr/scenarios'

export async function snapshotPublishedOutputs(
  outDir: string,
  events: Array<{ type: string, targetVersion?: number }>,
  supportsExplicitAcknowledgement: boolean,
  registeredControlSource?: string,
) {
  const published = events.findLast(event => event.type === 'batch-published')
  if (!supportsExplicitAcknowledgement || !published || typeof published.targetVersion !== 'number') {
    throw new Error('Cannot verify a complete HMR dist snapshot without the current batch-published signal')
  }
  return snapshotOutputCheckpoint(outDir, { type: published.type, targetVersion: published.targetVersion }, registeredControlSource)
}

export async function snapshotOutputCheckpoint(outDir: string, completionSignal: { type: string, targetVersion?: number }, registeredControlSource?: string) {
  const snapshotStartedAt = performance.now()
  const files = await snapshotBenchmarkOutputs(outDir)
  const snapshotCompletedAt = performance.now()
  const controlStartedAt = performance.now()
  const controlPath = path.join(outDir, WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE)
  const controlSource = await readFile(controlPath, 'utf8')
  const control = parseStatefulHmrControlSource(controlSource)
  const registeredControl = registeredControlSource ? parseStatefulHmrControlSource(registeredControlSource) : undefined
  const appSource = await readFile(path.join(outDir, 'app.js'), 'utf8')
  const controlReadCompletedAt = performance.now()
  const controlUrl = new URL(control.url)
  const references = {
    appImportsControl: appSource.includes(`./${WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE}`),
    controlFilePresent: Boolean(files[WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE]),
    preloadFilePresent: Boolean(files[WEAPP_VITE_STATEFUL_HMR_PRELOAD_FILE]),
    updateFilePresent: Boolean(files[WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE]),
  }
  const valid = Object.keys(control).sort().join(',') === 'buildId,token,url'
    && /^[a-f0-9]{32}$/i.test(control.buildId)
    && /^[a-f0-9]{32}$/i.test(control.token)
    && controlUrl.protocol === 'http:'
    && controlUrl.hostname === 'localhost'
    && controlUrl.username === ''
    && controlUrl.password === ''
    && controlUrl.search === ''
    && controlUrl.hash === ''
    && Number(controlUrl.port) > 0
    && Number(controlUrl.port) <= 65_535
    && controlUrl.pathname === '/__weapp_vite_stateful_hmr__'
    && Object.values(references).every(Boolean)
  if (!valid) {
    throw new Error('Stateful HMR control output failed its schema, shape, or referenced-file checks')
  }
  const canonicalControlSource = normalizeControlSource(controlSource, control)
  const registeredSessionMatches = Boolean(registeredControl && registeredControl.buildId === control.buildId && registeredControl.token === control.token && registeredControl.url === control.url)
  if (!registeredSessionMatches) {
    throw new Error('Stateful HMR output no longer matches the session registered by the benchmark client')
  }
  if (registeredControl) {
    for (const [file, manifest] of Object.entries(files)) {
      if (!file.endsWith('.js')) {
        continue
      }
      const source = await readFile(path.join(outDir, file), 'utf8')
      if (Buffer.byteLength(source, 'utf8') !== manifest.bytes || createHash('sha256').update(source).digest('hex') !== manifest.sha256) {
        throw new Error('HMR output changed while collecting its raw and canonical identity')
      }
      const updateBatch = file === WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE
        ? canonicalizeRegisteredUpdateBatch(source, registeredControl.buildId)
        : undefined
      const buildStamp = file === WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE
        ? undefined
        : canonicalizeRegisteredBuildStamp(source, registeredControl.buildId)
      const canonical = updateBatch ?? buildStamp
      if (canonical) {
        Object.assign(manifest, {
          canonicalBytes: Buffer.byteLength(canonical, 'utf8'),
          canonicalSha256: createHash('sha256').update(canonical).digest('hex'),
          normalized: updateBatch
            ? 'registered-stateful-hmr-batch-nonce-and-build-id'
            : 'registered-stateful-build-id-first-line',
        })
      }
    }
  }
  const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex')
  return {
    completionSignal,
    snapshotClock: 'benchmark-process-performance.now',
    snapshotDurationMs: snapshotCompletedAt - snapshotStartedAt,
    controlMetadataReadDurationMs: controlReadCompletedAt - controlStartedAt,
    controlContract: {
      schemaValid: true,
      registeredSessionMatches,
      buildIdShape: '32-hex',
      tokenShape: '32-hex',
      url: { protocol: controlUrl.protocol, hostname: controlUrl.hostname, pathname: controlUrl.pathname, portValid: true },
      references,
      sessionFieldFingerprints: {
        buildId: fingerprint(control.buildId),
        token: fingerprint(control.token),
      },
      sourceBytes: Buffer.byteLength(controlSource, 'utf8'),
      sourceSha256: fingerprint(controlSource),
      canonicalSourceBytes: Buffer.byteLength(canonicalControlSource, 'utf8'),
      canonicalSourceSha256: fingerprint(canonicalControlSource),
      bytes: files[WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE]!.bytes,
      sha256: files[WEAPP_VITE_STATEFUL_HMR_CONTROL_FILE]!.sha256,
    },
    files,
  }
}

export function canonicalizeRegisteredBuildStamp(source: string, registeredBuildId: string): string | undefined {
  const stamp = `// weapp-vite-stateful-build:${registeredBuildId}\n`
  if (!source.startsWith(stamp)) {
    return undefined
  }
  return `// weapp-vite-stateful-build:<REGISTERED_BUILD_ID>\n${source.slice(stamp.length)}`
}

export function canonicalizeRegisteredUpdateBatch(source: string, registeredBuildId: string): string | undefined {
  const firstLineEnd = source.indexOf('\n')
  if (firstLineEnd < 0 || !/^\/\/ [a-f0-9]{32}$/.test(source.slice(0, firstLineEnd))) {
    return undefined
  }
  const callPrefix = `globalThis.${WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY}.receiveBatch(`
  const header = source.slice(firstLineEnd + 1)
  if (!header.startsWith(callPrefix)) {
    return undefined
  }
  const metadataStart = firstLineEnd + 1 + callPrefix.length
  const metadataEnd = source.indexOf(', () => {\n', metadataStart)
  if (metadataEnd < 0) {
    return undefined
  }
  const metadataSource = source.slice(metadataStart, metadataEnd)
  let metadata: unknown
  try {
    metadata = JSON.parse(metadataSource)
  }
  catch {
    return undefined
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined
  }
  const record = metadata as Record<string, unknown>
  if (Object.keys(record).join(',') !== 'buildId,changedIds,compatible,fromVersion,targetVersion'
    || record.buildId !== registeredBuildId
    || !Array.isArray(record.changedIds) || !record.changedIds.every(id => typeof id === 'string')
    || record.compatible !== true
    || !Number.isInteger(record.fromVersion) || !Number.isInteger(record.targetVersion)
    || Number(record.fromVersion) < 0 || Number(record.targetVersion) < Number(record.fromVersion)
    || JSON.stringify(record) !== metadataSource) {
    return undefined
  }
  const bodyStart = metadataEnd + ', () => {\n'.length
  const footer = '\n});\n'
  const footerStart = source.lastIndexOf(footer)
  if (footerStart < bodyStart) {
    return undefined
  }
  const trailingSource = source.slice(footerStart + footer.length)
  if (trailingSource && !/^\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,[A-Za-z0-9+/=]+\n?$/.test(trailingSource)) {
    return undefined
  }
  const canonicalMetadata = JSON.stringify({ ...record, buildId: '<REGISTERED_BUILD_ID>' })
  return `// <REGISTERED_BATCH_NONCE>\n${callPrefix}${canonicalMetadata}, () => {\n${source.slice(bodyStart)}`
}

function normalizeControlSource(source: string, control: { buildId: string, token: string, url: string }) {
  const prefix = `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY)}] = `
  const start = source.indexOf(prefix)
  if (start < 0) {
    throw new Error('Stateful HMR control source does not use the expected generated assignment')
  }
  const jsonStart = start + prefix.length
  const end = source.indexOf(';', jsonStart)
  const objectSource = source.slice(jsonStart, end)
  if (end < 0 || objectSource !== JSON.stringify(control)) {
    throw new Error('Stateful HMR control object is not the exact generated JSON literal')
  }
  const normalized = JSON.stringify({
    buildId: '<BUILD_ID>',
    token: '<TOKEN>',
    url: 'http://localhost:<PORT>/__weapp_vite_stateful_hmr__',
  })
  return `${source.slice(0, jsonStart)}${normalized}${source.slice(end)}`
}

export async function readDiagnosticProfile(
  profilePath: string,
  pagePath: string,
  fixtureRoot: string,
  targetVersions: number[],
  acknowledgements: Array<{ buildIdFingerprint: string, targetVersion: number }>,
) {
  const content = await readFile(profilePath, 'utf8').catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
  if (content === undefined) {
    return { status: 'missing', samples: [], invalidLineCount: 0 }
  }
  const parsed: Record<string, unknown>[] = []
  let invalidLineCount = 0
  for (const line of content.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }
    try {
      const value: unknown = JSON.parse(line)
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        parsed.push(value as Record<string, unknown>)
      }
      else {
        invalidLineCount += 1
      }
    }
    catch {
      invalidLineCount += 1
    }
  }
  const relativePagePath = path.relative(fixtureRoot, pagePath).replaceAll('\\', '/')
  const registeredBuildIds = new Set(acknowledgements.map(event => event.buildIdFingerprint))
  const matching = parsed.flatMap((sample) => {
    const events = Array.isArray(sample.sourceEvents) ? sample.sourceEvents : []
    const sourceEvents = events.flatMap((event) => {
      if (!event || typeof event !== 'object' || Array.isArray(event)) {
        return []
      }
      const sourceEvent = event as Record<string, unknown>
      if (typeof sourceEvent.file !== 'string' || typeof sourceEvent.receivedAtMs !== 'number') {
        return []
      }
      const file = sourceEvent.file.replaceAll('\\', '/')
      return file === relativePagePath || file.endsWith(`/${relativePagePath}`)
        ? [{ eventId: sourceEvent.eventId, receivedAtMs: sourceEvent.receivedAtMs, clock: 'profile-producer-performance.now', file: relativePagePath }]
        : []
    })
    const batchId = typeof sample.batchId === 'string' ? sample.batchId : undefined
    const sequence = batchId ? Number(batchId.slice(batchId.lastIndexOf(':') + 1)) : undefined
    const buildIdFingerprint = typeof sample.buildId === 'string' ? createHash('sha256').update(sample.buildId).digest('hex') : undefined
    const safeSample = { ...sample }
    delete safeSample.buildId
    return sourceEvents.length ? [{ sample: redactFixturePaths(safeSample, fixtureRoot), matchingSourceEvents: sourceEvents, sequence, buildIdFingerprint, sameRegisteredSession: Boolean(buildIdFingerprint && registeredBuildIds.has(buildIdFingerprint)) }] : []
  }).sort((left, right) => (left.sequence ?? Number.MAX_SAFE_INTEGER) - (right.sequence ?? Number.MAX_SAFE_INTEGER))
  const checkpointTargets = targetVersions.filter((version, index) => index === 0 || version !== targetVersions[index - 1])
  return {
    status: parsed.length ? 'available' : 'empty',
    matchingSourceEventCount: matching.length,
    sessionMatchedSampleCount: matching.filter(item => item.sameRegisteredSession).length,
    samples: matching.map(item => ({ ...item, phaseAssociation: 'unassigned' })),
    invalidLineCount,
    publishedTargetVersions: checkpointTargets,
    checkpointAssociation: 'unassigned; profile batch sequence has no shared identifier with transport targetVersion',
    attribution: 'matched by source file; producer batch sequence and clock are retained independently from benchmark checkpoint identity',
  }
}

function redactFixturePaths(value: unknown, fixtureRoot: string): unknown {
  if (typeof value === 'string') {
    return value.replaceAll(fixtureRoot, '<fixture>').replaceAll(fixtureRoot.replaceAll('\\', '/'), '<fixture>')
  }
  if (Array.isArray(value)) {
    return value.map(item => redactFixturePaths(item, fixtureRoot))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactFixturePaths(item, fixtureRoot)]))
  }
  return value
}
