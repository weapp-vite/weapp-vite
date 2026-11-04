import type { CorpusSelection, CorpusSource } from '../types'
import type { GitTreeEntry } from './github'
import assert from 'node:assert/strict'
import picomatch from 'picomatch'

export { extractContainerTemplate } from './container'

/** 收集范围由固定清单决定，不能由候选解析器的成功与否决定。 */
export function matchesSelection(file: string, selection: CorpusSelection): boolean {
  const matches = (patterns: readonly string[]) => patterns.some(pattern => picomatch(pattern, { dot: true })(file))
  return selection.extensions.some(extension => file.toLowerCase().endsWith(extension.toLowerCase()))
    && (!selection.include?.length || matches(selection.include))
    && (!selection.exclude?.length || !matches(selection.exclude))
}

export function validateSourceIdentity(source: Pick<CorpusSource, 'repository' | 'commit' | 'license'>, files: readonly GitTreeEntry[]) {
  assert.ok(/^[\w.-]+\/[\w.-]+$/.test(source.repository), 'Invalid corpus source repository')
  assert.ok(/^[\da-f]{40}$/.test(source.commit), 'Corpus source must use a complete commit SHA')
  assert.ok(source.license.spdx && !['NOASSERTION', 'NONE'].includes(source.license.spdx), 'Corpus source license is unconfirmed')
  assert.ok(source.license.files.length, 'Corpus source needs explicit license files')
  const paths = new Set(files.map(file => file.path))
  for (const file of source.license.files) {
    assert.ok(paths.has(file), `Corpus license file is missing: ${file}`)
    assert.ok(files.some(entry => entry.path === file && entry.type === 'blob' && entry.mode !== '120000'), `Corpus license must be a regular source file: ${file}`)
  }
}

export function validateSource(source: CorpusSource, files: readonly GitTreeEntry[]) {
  validateSourceIdentity(source, files)
  const paths = new Set(files.map(file => file.path))
  assert.ok(source.selections.length, 'Corpus source needs explicit platform selections')
  for (const selection of source.selections) {
    assert.ok(selection.evidence.length, 'Corpus platform selection needs project evidence')
    assert.ok(selection.extensions.length && selection.extensions.every(extension => /^\.[a-z\d]+$/i.test(extension)), 'Invalid corpus template extensions')
    for (const evidence of selection.evidence) {
      assert.ok(paths.has(evidence), `Corpus project evidence is missing: ${evidence}`)
    }
  }
}

/** 同名后缀不是平台身份；敏感后缀还须有模板内容和相邻小程序文件。 */
export function suspiciousExtension(file: string, source: string, files: readonly GitTreeEntry[], confirmedProject = false): string | undefined {
  if (!/\.(?:ksml|tyml)$/i.test(file)) {
    return undefined
  }
  const scriptSidecar = files.some(candidate => candidate.path === `${file.slice(0, file.lastIndexOf('.'))}.js` || candidate.path === `${file.slice(0, file.lastIndexOf('.'))}.ts`)
  if (!/<[a-z_][\w:.-]*(?:\s|\/?>)/i.test(source) && !(confirmedProject && scriptSidecar)) {
    return 'ambiguous-extension-without-template-markup'
  }
  const stem = file.slice(0, file.lastIndexOf('.'))
  if (!files.some(candidate => candidate.path.startsWith(`${stem}.`) && /\.(?:json|js|ts|css|tyss|ks)$/i.test(candidate.path))) {
    return 'ambiguous-extension-without-mini-program-sidecar'
  }
  return undefined
}
