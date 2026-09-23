import { fs } from '@weapp-core/shared/node'
import path from 'pathe'

const VENDOR_MEMBER_REQUIRE_RE = /require\(\s*["']([^"']*weapp-vendors\/[^"']+\.js)["']\)\.([A-Za-z_$][\w$]*)/g
const VENDOR_VARIABLE_REQUIRE_RE = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(\s*["']([^"']*weapp-vendors\/[^"']+\.js)["']\s*\)/g
const VENDOR_DESTRUCTURE_REQUIRE_RE = /\b(?:const|let|var)\s+\{([^}]+)\}\s*=\s*require\(\s*["']([^"']*weapp-vendors\/[^"']+\.js)["']\s*\)/g
const VENDOR_EXPORT_RE = /Object\.defineProperty\(exports,\s*["']([^"']+)["']|\bexports\.([A-Za-z_$][\w$]*)\s*=/g

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function collectVendorExports(vendorPath: string) {
  const source = await fs.readFile(vendorPath, 'utf8')
  const exports = new Set<string>()
  for (const match of source.matchAll(VENDOR_EXPORT_RE)) {
    const name = match[1] ?? match[2]
    if (name) {
      exports.add(name)
    }
  }
  return exports
}

/**
 * @description 检查小程序产物引用的 vendor 成员是否仍由对应 chunk 导出。
 */
export async function findMissingWevuVendorExports(distRoot: string) {
  const files = await fs.readdir(distRoot, { recursive: true })
  const missing = new Set<string>()
  const exportCache = new Map<string, Set<string>>()

  for (const file of files) {
    const normalizedFile = typeof file === 'string' ? file.replaceAll('\\', '/') : ''
    if (!normalizedFile || !normalizedFile.endsWith('.js') || normalizedFile.includes('/weapp-vendors/')) {
      continue
    }

    const jsPath = path.join(distRoot, file)
    const source = await fs.readFile(jsPath, 'utf8')
    const usedMembers: Array<{ request: string, member: string }> = []

    for (const match of source.matchAll(VENDOR_MEMBER_REQUIRE_RE)) {
      const request = match[1]
      const member = match[2]
      if (request && member) {
        usedMembers.push({ request, member })
      }
    }

    for (const match of source.matchAll(VENDOR_DESTRUCTURE_REQUIRE_RE)) {
      const bindings = match[1]
      const request = match[2]
      if (!bindings || !request) {
        continue
      }
      for (const rawBinding of bindings.split(',')) {
        const member = rawBinding.trim().split(/\s*:\s*/)[0]
        if (member) {
          usedMembers.push({ request, member })
        }
      }
    }

    for (const match of source.matchAll(VENDOR_VARIABLE_REQUIRE_RE)) {
      const variableName = match[1]
      const request = match[2]
      if (!variableName || !request) {
        continue
      }
      const memberRe = new RegExp(`\\b${escapeRegExp(variableName)}\\.([A-Za-z_$][\\w$]*)`, 'g')
      const declarationEnd = (match.index ?? 0) + match[0].length
      for (const memberMatch of source.slice(declarationEnd).matchAll(memberRe)) {
        const member = memberMatch[1]
        if (member) {
          usedMembers.push({ request, member })
        }
      }
    }

    for (const { request, member } of usedMembers) {
      const resolved = path.resolve(path.dirname(jsPath), request)
      if (!(await fs.pathExists(resolved))) {
        continue
      }
      let exports = exportCache.get(resolved)
      if (!exports) {
        exports = await collectVendorExports(resolved)
        exportCache.set(resolved, exports)
      }
      if (!exports.has(member)) {
        missing.add(`${path.relative(distRoot, resolved).replaceAll('\\', '/')}#${member}`)
      }
    }
  }

  return [...missing].sort()
}
