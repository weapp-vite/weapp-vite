import assert from 'node:assert/strict'
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = realpathSync(process.env.PROVIDER_COST_ROOT)
const modules = new Map()
const edges = new Map()

function local(url) {
  if (!url?.startsWith('file:')) {
    return url?.startsWith('node:') ? url : '<virtual>'
  }
  const file = realpathSync(fileURLToPath(url))
  const relative = path.relative(root, file).replaceAll('\\', '/')
  assert(relative && !relative.startsWith('../') && !path.isAbsolute(relative), 'Build resolved a module outside its installed consumer')
  return relative
}

function record(url, phase) {
  if (!url.startsWith('file:')) {
    return
  }
  const file = realpathSync(fileURLToPath(url))
  const label = local(url)
  const existing = modules.get(label) ?? { file: label, bytes: statSync(file).size, resolved: false, loaded: false }
  existing[phase] = true
  if (!existing.package) {
    for (let directory = path.dirname(file); directory.startsWith(root + path.sep); directory = path.dirname(directory)) {
      try {
        const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'))
        if (!manifest.name) {
          continue
        }
        existing.package = manifest.name
        existing.version = manifest.version ?? null
        existing.packageRoot = path.relative(root, directory).replaceAll('\\', '/')
        break
      }
      catch (error) {
        if (error.code !== 'ENOENT') {
          throw error
        }
      }
    }
  }
  modules.set(label, existing)
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context)
    record(result.url, 'resolved')
    const edge = { from: local(context.parentURL), to: local(result.url) }
    edges.set(JSON.stringify(edge), edge)
    return result
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context)
    record(url, 'loaded')
    return result
  },
})
process.on('exit', (exitCode) => {
  writeFileSync(process.env.PROVIDER_COST_TRACE, `${JSON.stringify({
    schemaVersion: 1,
    exitCode,
    instrumented: true,
    scope: 'main Node build process resolve/load hooks; excludes native internals and other processes; load does not prove call or vulnerability reachability',
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    finalRssBytes: process.memoryUsage().rss,
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
    modules: [...modules.values()].sort((a, b) => a.file.localeCompare(b.file)),
    edges: [...edges.values()],
  }, null, 2)}\n`)
})
