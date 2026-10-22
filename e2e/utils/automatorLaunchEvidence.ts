import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const evidencePathEnv = 'WEAPP_VITE_E2E_LAUNCH_EVIDENCE_PATH'
const omittedMessage = /command failed|escapedCommand|spawnargs|\bargv\b|--[\w-]+/i
const settingKeys = ['compileHotReLoad', 'useMultiFrameRuntime', 'useApiHook', 'useApiHostProcess', 'useIsolateContext', 'enableEngineNative', 'useCompilerPlugins', 'es6', 'enhance', 'minified', 'minifyWXSS', 'minifyWXML', 'postcss', 'packNpmManually', 'useSkyline', 'compileWorklet']

interface LaunchEvidenceDetails {
  attempt?: number
  requestedProjectPath?: string
  actualProjectPath?: string
  selectedInstallation?: unknown
  launchOptions?: unknown
  rejection?: unknown
}

interface LaunchEvidenceOptions extends LaunchEvidenceDetails {
  launchId?: string
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: string) {
  // 授权方案和 Cookie 可包含空格、分号；整行移除值，避免只遮掉 Bearer 或首个 Cookie。
  const headersRedacted = value.replace(/(^|[?&\s"'])([\w-]*(?:authorization|cookie)[\w-]*["']?[^\S\r\n]*[:=][^\S\r\n]*)(?:\S[^\r\n]*)?/gi, '$1$2[redacted]')
  return headersRedacted.replace(/(^|[?&\s"'])([\w-]*(?:ticket|account|token|password|secret|authorization|cookie|credential)[\w-]*["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s&,;]+)/gi, '$1$2[redacted]')
}

function scalar(value: unknown): unknown {
  if (typeof value === 'string') {
    return text(value)
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }
  return undefined
}

function pick(value: unknown, keys: readonly string[]) {
  const record = object(value)
  return Object.fromEntries(keys.filter(key => Object.hasOwn(record, key)).flatMap((key) => {
    const selected = scalar(record[key])
    return selected === undefined ? [] : [[key, selected]]
  }))
}

/** 只保留错误的类型和诊断字段；不保存命令、输出流或任意对象中的凭据。 */
export function serializeLaunchRejection(value: unknown, seen = new WeakSet<object>(), depth = 0): Record<string, unknown> {
  if (value === null) {
    return { type: 'null', value: null }
  }
  if (value === undefined) {
    return { type: 'undefined' }
  }
  if (typeof value !== 'object') {
    if (typeof value === 'string') {
      return { type: 'string', value: value.split(/\r?\n/).map(line => omittedMessage.test(line) ? '[command omitted]' : text(line)).join('\n') }
    }
    return { type: typeof value, ...(['boolean', 'number', 'bigint'].includes(typeof value) ? { value: typeof value === 'bigint' ? String(value) : value } : {}) }
  }
  if (seen.has(value) || depth >= 6) {
    return { type: 'object', circularOrTruncated: true }
  }
  seen.add(value)
  const record = value as Record<string, unknown>
  const error = value instanceof Error ? value : undefined
  const message = error?.message ?? record.message
  const result: Record<string, unknown> = {
    type: error ? 'Error' : 'object',
    ...pick({ name: error?.name ?? record.name, code: record.code, errno: record.errno, syscall: record.syscall }, ['name', 'code', 'errno', 'syscall']),
  }
  if (typeof message === 'string') {
    result.message = message.split(/\r?\n/).map(line => omittedMessage.test(line) ? '[command omitted]' : text(line)).join('\n')
  }
  if ('cause' in record) {
    result.cause = serializeLaunchRejection(record.cause, seen, depth + 1)
  }
  if (value instanceof AggregateError) {
    result.errors = value.errors.map(item => serializeLaunchRejection(item, seen, depth + 1))
  }
  return result
}

function inspectFile(file: string) {
  try {
    const bytes = fs.readFileSync(file)
    return { path: file, status: 'present', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return { path: file, status: code === 'ENOENT' ? 'missing' : 'unreadable', code }
  }
}

function readJson(file: string): { metadata: Record<string, unknown>, value: Record<string, unknown> } {
  try {
    const bytes = fs.readFileSync(file)
    const metadata = { path: file, status: 'present', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }
    try {
      return { metadata, value: object(JSON.parse(bytes.toString('utf8')) as unknown) }
    }
    catch (error) {
      return { metadata: { ...metadata, status: 'invalid-json', error: serializeLaunchRejection(error) }, value: {} }
    }
  }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return { metadata: { path: file, status: code === 'ENOENT' ? 'missing' : 'unreadable', code }, value: {} }
  }
}

function projectConfig(value: unknown) {
  const config = object(value)
  const condition = object(object(config.condition).miniprogram)
  const setting = pick(config.setting, settingKeys)
  const compilerPlugins = object(config.setting).useCompilerPlugins
  if (Array.isArray(compilerPlugins)) {
    setting.useCompilerPlugins = compilerPlugins.filter((item): item is string => typeof item === 'string').map(text)
  }
  return {
    ...pick(config, ['libVersion', 'miniprogramRoot', 'srcMiniprogramRoot', 'compileType', 'simulatorType', 'renderer']),
    setting,
    condition: {
      miniprogram: {
        ...pick(condition, ['current']),
        list: Array.isArray(condition.list) ? condition.list.map(item => pick(item, ['id', 'name', 'pathName', 'query', 'scene'])) : [],
      },
    },
  }
}

function launchOptions(value: unknown) {
  const options = object(value)
  return {
    ...pick(options, ['projectPath', 'cliPath', 'cwd', 'timeout', 'trustProject', 'launchMode', 'bridgeProjectMode', 'warmupRoute', 'skipWarmup', 'warmupAllowRelaunch', 'refreshProjectAfterConnect', 'prebuild', 'maxLaunchRetries']),
    ...(Object.hasOwn(options, 'projectConfig') ? { projectConfig: projectConfig(options.projectConfig) } : {}),
  }
}

function sourceConfigModules(projectRoot: string) {
  return ['weapp-vite.config', 'vite.config'].flatMap(name => ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs'].map(extension => inspectFile(path.resolve(projectRoot, `${name}.${extension}`)))).filter(file => file.status !== 'missing')
}

function projectInventory(projectPath: string) {
  const projectRoot = path.resolve(projectPath)
  const publicConfig = readJson(path.join(projectRoot, 'project.config.json'))
  const privateConfig = readJson(path.join(projectRoot, 'project.private.config.json'))
  const rootOwner = [publicConfig, privateConfig].find(config => typeof config.value.miniprogramRoot === 'string' && config.value.miniprogramRoot.trim())
  const runtimeRoot = path.resolve(projectRoot, rootOwner?.value.miniprogramRoot as string | undefined ?? './')
  const app = readJson(path.join(runtimeRoot, 'app.json'))
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(text) : []
  const subpackages = (value: unknown) => Array.isArray(value)
    ? value.map(item => ({ ...pick(item, ['root', 'independent']), pages: strings(object(item).pages) }))
    : []
  const pages = strings(app.value.pages)
  const groups = [...subpackages(app.value.subPackages), ...subpackages(app.value.subpackages)]
  const routes = [...new Set([...pages, ...groups.flatMap(group => group.pages.map(page => `${String((group as Record<string, unknown>).root ?? '')}/${page}`))])]
  return {
    projectRoot,
    publicConfig: { ...publicConfig.metadata, summary: projectConfig(publicConfig.value) },
    privateConfig: { ...privateConfig.metadata, summary: projectConfig(privateConfig.value) },
    runtimeRoot,
    runtimeRootSource: rootOwner?.metadata.path ?? 'default',
    sourceConfigModules: sourceConfigModules(projectRoot),
    app: { ...app.metadata, summary: { pages, subPackages: subpackages(app.value.subPackages), subpackages: subpackages(app.value.subpackages), ...pick(app.value, ['entryPagePath']) } },
    declaredPages: routes.map((route) => {
      const base = path.resolve(runtimeRoot, route)
      const relative = path.relative(runtimeRoot, base)
      if (path.isAbsolute(route) || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        return { route: text(route), status: 'invalid-route' }
      }
      return { route: text(route), files: Object.fromEntries(['js', 'json', 'wxml', 'wxss'].map(extension => [extension, inspectFile(`${base}.${extension}`)])) }
    }),
  }
}

/** 显式启用时只读采集本地启动证据；采集失败作为次要错误保留，不改变启动控制流。 */
export function createAutomatorLaunchEvidence(sourceModule: string, options: LaunchEvidenceOptions = {}) {
  const destination = process.env[evidencePathEnv]?.trim()
  const launchId = options.launchId ?? randomUUID()
  const failures: unknown[] = []
  const started = performance.now()
  let sequence = 0
  const source = sourceModule.startsWith('file:') ? fileURLToPath(sourceModule) : path.resolve(sourceModule)
  const evidencePath = destination ? path.resolve(destination) : undefined
  const record = (phase: string, details: LaunchEvidenceDetails = {}) => {
    if (!evidencePath) {
      return
    }
    try {
      const input = { ...options, ...details }
      const actualProjectPath = input.actualProjectPath ?? object(input.launchOptions).projectPath
      const event = {
        schemaVersion: 1,
        launchId,
        phase,
        sequence: sequence++,
        observedAt: new Date().toISOString(),
        elapsedMs: performance.now() - started,
        sourceModule: inspectFile(source),
        cwd: process.cwd(),
        ...pick(input, ['attempt', 'requestedProjectPath', 'actualProjectPath']),
        ...(input.requestedProjectPath ? { requestedSourceConfigModules: sourceConfigModules(input.requestedProjectPath) } : {}),
        ...(input.selectedInstallation ? { selectedInstallation: pick(input.selectedInstallation, ['cliPath', 'appPath', 'installationId', 'version', 'channel']) } : {}),
        ...(input.launchOptions ? { launchOptions: launchOptions(input.launchOptions) } : {}),
        ...(Object.hasOwn(input, 'rejection') ? { rejection: serializeLaunchRejection(input.rejection) } : {}),
        ...(typeof actualProjectPath === 'string' ? { actualProjectPath: path.resolve(actualProjectPath), inventory: projectInventory(actualProjectPath) } : {}),
        ...(failures.length ? { secondaryFailures: failures.map(error => serializeLaunchRejection(error)) } : {}),
      }
      fs.appendFileSync(evidencePath, `${JSON.stringify(event)}\n`, { mode: 0o600 })
    }
    catch (error) {
      failures.push(error)
      try {
        // 不向正式报告泄露路径或错误正文；失败详情仅由本地 collector 保留。
        process.stderr.write(`[launch-evidence-secondary] ${JSON.stringify({ phase, type: error instanceof Error ? error.name : typeof error, code: scalar(object(error).code) })}\n`)
      }
      catch {
        // 诊断通道不可用时仍保留 failures，不覆盖原始启动异常。
      }
    }
  }
  return { enabled: Boolean(evidencePath), launchId, record, getFailures: () => [...failures] }
}
