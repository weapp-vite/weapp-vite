import { createHash } from 'node:crypto'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'

/** 只读记录作用域插槽的实际交付与产物，不导航或改变现有会话。 */
export async function captureScopedSlotDiagnostics(projectRoot: string, miniProgram: any, stage: string) {
  const evidence: Record<string, unknown> = { projectRoot, stage }
  const configuration: Record<string, unknown> = {}
  for (const file of ['project.config.json', 'project.private.config.json']) {
    try {
      configuration[file] = await fs.readJson(path.join(projectRoot, file)) as unknown
    }
    catch (error) {
      configuration[file] = { error: error instanceof Error ? error.message : String(error) }
    }
  }
  evidence.configuration = configuration
  try {
    const source = await fs.readFile(path.join(projectRoot, '.tmp/hmr-profile.jsonl'), 'utf8')
    evidence.publications = source.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line) as unknown)
  }
  catch (error) {
    evidence.publicationError = error instanceof Error ? error.message : String(error)
  }
  try {
    evidence.runtime = await miniProgram.evaluate(() => {
      const page = getCurrentPages().at(-1) as any
      function snapshot(value: unknown) {
        const seen = new WeakSet<object>()
        return JSON.parse(JSON.stringify(value ?? null, (_key, item: unknown) => {
          if (typeof item === 'function') {
            return undefined
          }
          if (item && typeof item === 'object') {
            if (seen.has(item)) {
              return '[Circular]'
            }
            seen.add(item)
          }
          return item
        })) as unknown
      }
      function observe(read: () => unknown) {
        try {
          return { value: snapshot(read()) }
        }
        catch (error) {
          return { error: error instanceof Error ? error.message : String(error) }
        }
      }
      function component(instance: any) {
        return {
          present: Boolean(instance),
          is: observe(() => instance?.is),
          data: observe(() => instance?.data),
          properties: observe(() => instance?.properties),
        }
      }
      let host: any
      const selection = observe(() => {
        host = page?.selectComponent?.('#scoped-host')
        return Boolean(host)
      })
      return {
        page: component(page),
        selection,
        host: component(host),
        children: observe(() => (host?.selectAllComponents?.('*') ?? []).map(component)),
      }
    })
  }
  catch (error) {
    evidence.runtimeError = error instanceof Error ? error.message : String(error)
  }
  try {
    const outDir = path.join(projectRoot, 'dist')
    const pageConfigFile = path.join(outDir, 'pages/wevu/index.json')
    const pageConfig = await fs.readJson(pageConfigFile) as { usingComponents?: Record<string, string> }
    const bases = [path.join(outDir, 'app'), path.join(outDir, 'pages/wevu/index'), path.join(outDir, 'components/scoped-host/index')]
    for (const target of Object.values(pageConfig.usingComponents ?? {})) {
      if (target.includes('.__scoped-slot-')) {
        bases.push(target.startsWith('/') ? path.join(outDir, target.slice(1)) : path.resolve(path.dirname(pageConfigFile), target))
      }
    }
    const files: Array<Record<string, unknown>> = []
    for (const base of new Set(bases)) {
      for (const extension of ['js', 'json', 'wxml']) {
        const file = `${base}.${extension}`
        try {
          const bytes = await fs.readFile(file)
          files.push({
            file: path.relative(projectRoot, file).replaceAll('\\', '/'),
            bytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            ...(extension !== 'js' ? { source: bytes.toString('utf8') } : {}),
          })
        }
        catch (error) {
          files.push({ file: path.relative(projectRoot, file).replaceAll('\\', '/'), error: error instanceof Error ? error.message : String(error) })
        }
      }
    }
    evidence.artifacts = files
  }
  catch (error) {
    evidence.artifactError = error instanceof Error ? error.message : String(error)
  }
  // eslint-disable-next-line no-console -- 诊断只读输出运行证据，供外层在 fixture 清理前精确归档。
  console.info(`[hmr-scoped-slot-diagnostic] ${JSON.stringify(evidence)}`)
}
