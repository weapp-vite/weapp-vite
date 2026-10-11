import assert from 'node:assert/strict'

export interface RootAlias { root: string, alias: string }

/** 只允许这些已核验的完整公开仓库路径，保持原始 manifest 键与哈希域不变。 */
export const publicRepositoryPaths = [
  'apps/vite-native/components/icebreaker/index.json',
  'apps/vite-native/components/icebreaker/index.scss',
  'apps/vite-native/components/icebreaker/index.ts',
  'apps/vite-native/components/icebreaker/index.wxml',
  'packages/weapp-vite/test/fixtures/circularReference/components/icebreaker/index.json',
  'packages/weapp-vite/test/fixtures/circularReference/components/icebreaker/index.scss',
  'packages/weapp-vite/test/fixtures/circularReference/components/icebreaker/index.ts',
  'packages/weapp-vite/test/fixtures/circularReference/components/icebreaker/index.wxml',
  'test/fixture-projects/weapp-vite/auto-import/src/components/icebreaker/index.json',
  'test/fixture-projects/weapp-vite/auto-import/src/components/icebreaker/index.scss',
  'test/fixture-projects/weapp-vite/auto-import/src/components/icebreaker/index.ts',
  'test/fixture-projects/weapp-vite/auto-import/src/components/icebreaker/index.wxml',
  'test/fixture-projects/weapp-vite/auto.import/src/components/icebreaker/index.json',
  'test/fixture-projects/weapp-vite/auto.import/src/components/icebreaker/index.scss',
  'test/fixture-projects/weapp-vite/auto.import/src/components/icebreaker/index.ts',
  'test/fixture-projects/weapp-vite/auto.import/src/components/icebreaker/index.wxml',
  'packages/qr/test/fixtures/mini-program-codes/imported/icebreaker.jpg',
  'website/public/icebreaker.code-profile',
  'website/public/icebreaker.jpg',
  'website/public/icebreaker.json',
  'website/public/icebreaker.txt',
]

/** 公开静态资源的构建副本，导出时必须逐项验证其内容哈希与受跟踪的源文件一致。 */
export const publicGeneratedPaths = [
  'website/dist/icebreaker.code-profile',
  'website/dist/icebreaker.jpg',
  'website/dist/icebreaker.json',
  'website/dist/icebreaker.txt',
]

/** 仅生成扫描副本；解码常见转义以防隐私信息藏在编码字符串中，不修改公开字节。 */
function scanVariants(value: string) {
  const variants = new Set([value])
  let current = value
  for (let depth = 0; depth < 3; depth++) {
    const decoded = current.replace(/\\u\{([a-f\d]{1,6})\}/gi, (text, hex: string) => Number.parseInt(hex, 16) <= 0x10FFFF ? String.fromCodePoint(Number.parseInt(hex, 16)) : text)
      .replace(/\\u([a-f\d]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replace(/\\x([a-f\d]{2})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
      .replaceAll('\\/', '/')
      .replace(/(?:%[a-f\d]{2})+/gi, (text) => {
        try {
          return decodeURIComponent(text)
        }
        catch {
          // 非法 UTF-8 不应遮蔽同组中的 ASCII 路径/邮箱分隔符；仅扫描副本使用占位符。
          return text.replace(/%([a-f\d]{2})/gi, (_, hex: string) => Number.parseInt(hex, 16) < 128 ? String.fromCharCode(Number.parseInt(hex, 16)) : '<encoded-byte>')
        }
      })
    if (decoded === current) {
      break
    }
    variants.add(decoded)
    current = decoded
  }
  return variants
}

function assertPublicVariant(value: string, privateTerms: string[]) {
  assert(!/(?<![\w.-])(?:\/(?:Users|home|private\/var|var\/folders|private\/tmp|tmp)\/|[a-z]:[\\/]+Users[\\/])/i.test(value), 'Unknown private absolute or temporary path remains in public content')
  assert(!/\bweapp-rust-runtime(?:-next)?-[a-z\d]{4,}\b/i.test(value), 'Private generated runtime identifier remains in public content')
  assert(!/\b[\w.%+-]+@[A-Z\d.-]+\.[A-Z]{2,}\b/i.test(value), 'Email address remains in public content')
  // 只豁免完整 JSON/JS 字符串中的精确仓库路径，不豁免任意账号、子串或绝对路径。
  const accountScan = [...publicRepositoryPaths, ...publicGeneratedPaths].reduce((text, file) => text.replaceAll(JSON.stringify(file), '"<verified-public-fixture-path>"').replaceAll(`'${file}'`, '"<verified-public-fixture-path>"'), value)
  for (const term of privateTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    assert(!new RegExp(`(?<![a-z\\d_])${escaped}(?![a-z\\d_])`, 'i').test(accountScan), 'Local account or private root identifier remains in public content')
  }
}

/** 解压后也必须扫描正文；禁止未知私人目录、账号、邮箱进入公开证据。 */
export function assertPublicText(value: string, privateTerms: string[] = []) {
  for (const variant of scanVariants(value)) {
    assertPublicVariant(variant, privateTerms)
  }
}

/** 只替换已核验的根身份；未知私人路径必须阻止导出。 */
export function createRedactor(roots: RootAlias[]) {
  const replacements = roots.flatMap(({ root, alias }) => {
    const entries = [root, root.replaceAll('\\', '/'), root.replaceAll('\\', '\\\\')].map(value => ({ value, alias }))
    let encodedRoot = root
    let encodedAlias = alias
    for (let depth = 0; depth < 3; depth++) {
      encodedRoot = encodeURIComponent(encodedRoot)
      encodedAlias = encodeURIComponent(encodedAlias)
      entries.push({ value: encodedRoot, alias: encodedAlias }, { value: encodedRoot.replace(/%[a-f\d]{2}/gi, value => value.toLowerCase()), alias: encodedAlias })
    }
    return entries
  })
    .filter(item => item.value.length > 1)
    .sort((a, b) => b.value.length - a.value.length)
  const known = new Map<string, string>()
  for (const item of replacements) {
    if (known.has(item.value)) {
      assert.equal(known.get(item.value), item.alias, 'One private root has conflicting public identities')
    }
    known.set(item.value, item.alias)
  }
  const privateTerms = [...new Set(roots.flatMap(({ root }) => {
    const user = /\/(?:Users|home)\/([^/]+)/.exec(root)?.[1]
    const worktree = /\/\.codex\/worktrees\/([^/]+)/.exec(root)?.[1]
    const generated = root.split('/').filter(part => /^weapp-rust-runtime(?:-next)?-[a-z\d]+$/i.test(part))
    return [...user ? [user] : [], ...worktree ? [worktree] : [], ...generated]
  }))]
  function text(value: string) {
    let result = value
    let count = 0
    for (const [root, alias] of known) {
      const pieces = result.split(root)
      result = pieces.shift()!
      for (const suffix of pieces) {
        const boundary = suffix.length === 0 || /^[/\\\s"'`?#:;,)\]}]/u.test(suffix) || /^%(?:25)*(?:2f|5c|3f|23|3a|22|27|60|20|09|0a|0d|29|2c|3b|5d|7d)/iu.test(suffix)
        result += `${boundary ? alias : root}${suffix}`
        if (boundary) {
          count++
        }
      }
    }
    assertPublicText(result, privateTerms)
    return { text: result, count }
  }
  function json<T>(value: T): { value: T, count: number } {
    const result = text(JSON.stringify(value))
    return { value: JSON.parse(result.text) as T, count: result.count }
  }
  return { text, json, assertPublic: (value: string) => assertPublicText(value, privateTerms), publicAliases: [...new Set(roots.map(root => root.alias))], policy: 'declared-exact-root-and-uri-encoded-root-replacement-v2; preserve all remaining text and values; reject unknown private paths/accounts/emails; allow only verified exact quoted repository paths and hash-identical generated copies' }
}
