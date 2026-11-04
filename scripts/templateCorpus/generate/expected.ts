import type { CorpusDocument } from '../types'
import type { GenerationIdentity } from './types'
import assert from 'node:assert/strict'
import { parse } from '@babel/parser'
import { corpusHash } from '../integrity'
import { getCorpusProfile } from '../profiles'
import { validateGenerationIdentity } from './identity'

interface StaticNode {
  type: string
  start?: number
  end?: number
  [key: string]: unknown
}

export interface StaticSnapshot {
  key: string
  source: string
  start: number
  end: number
  section?: { path: string, start: number, end: number }
}

export type SnapshotFormat = 'jest' | 'literal' | 'jest-files'

export interface SnapshotExtraction {
  snapshots: StaticSnapshot[]
  rejected: Array<{ key: string, start: number, end: number, reason: string }>
}

function node(value: unknown): StaticNode | undefined {
  if (value && typeof value === 'object' && 'type' in value && typeof value.type === 'string') {
    return value as StaticNode
  }
}

function staticString(value: unknown): string | undefined {
  const selected = node(value)
  if (selected?.type === 'StringLiteral' && typeof selected.value === 'string') {
    return selected.value
  }
  if (selected?.type === 'TemplateLiteral' && Array.isArray(selected.expressions) && !selected.expressions.length && Array.isArray(selected.quasis) && selected.quasis.length === 1) {
    const quasi = node(selected.quasis[0])
    const value = quasi?.value
    if (value && typeof value === 'object' && 'cooked' in value && typeof value.cooked === 'string') {
      return value.cooked
    }
  }
}

function memberProperty(selected: StaticNode | undefined): string | undefined {
  const property = node(selected?.property)
  return property?.type === 'Identifier' && !selected?.computed && typeof property.name === 'string' ? property.name : staticString(property)
}

function decodeJestSnapshot(value: string): string {
  const trimmed = value.trim()
  assert.ok(trimmed.startsWith('"') && trimmed.endsWith('"'), 'Snapshot is not an isolated pretty-format string')
  return trimmed.slice(1, -1).replace(/\\(["\\])/g, '$1')
}

function snapshotFile(file: string): boolean {
  return Boolean(file) && !file.startsWith('/') && !/[\\:]/.test(file)
    && ![...file].some(character => character.charCodeAt(0) <= 0x1F || character.charCodeAt(0) === 0x7F)
    && file.split('/').every(part => part && part !== '.' && part !== '..')
}

/** 保留冻结 snapshot 中的精确文件区域，不猜测其 serializer 处理前的文件字节。 */
function fileSections(value: string, files: readonly string[]): Array<{ source: string, section: NonNullable<StaticSnapshot['section']> }> {
  const markers = [...value.matchAll(/\n\/\*\* filePath: ([^\r\n]+) \*\*\/\n/g)]
  assert.ok(markers.length && markers[0]!.index === 0, 'Snapshot does not match the frozen file-section serializer')
  const paths = new Set<string>()
  const sections = markers.map((marker, index) => {
    const path = marker[1]!
    assert.ok(snapshotFile(path) && !paths.has(path.toLowerCase()), 'Unsafe or duplicate snapshot file-section path')
    paths.add(path.toLowerCase())
    const start = marker.index! + marker[0].length
    const end = markers[index + 1]?.index ?? value.length
    assert.ok(end >= start, 'Snapshot file-section overlaps its next marker')
    return { source: value.slice(start, end), section: { path, start, end } }
  })
  assert.ok(files.every(file => sections.some(section => section.section.path === file)), 'Snapshot is missing an explicitly selected template file')
  return sections.filter(section => files.includes(section.section.path))
}

/** 只读取字面量 snapshot；不运行 exports、测试、表达式或上游编译脚本。 */
export function extractStaticSnapshots(source: string, format: SnapshotFormat = 'jest', files?: readonly string[]): SnapshotExtraction {
  assert.ok(['jest', 'literal', 'jest-files'].includes(format), 'Unknown static snapshot format')
  if (format === 'jest-files') {
    assert.ok(files?.length && new Set(files).size === files.length && files.every(file => snapshotFile(file) && /\.(?:wxml|axml|swan|ttml|jxml|xhsml|qml|ksml|tyml|ddml|qxml|hxml|hml)$/.test(file)), 'File-section snapshots require explicit portable markup template paths')
  }
  else {
    assert.ok(files === undefined, 'Snapshot file selection requires jest-files format')
  }
  const ast = parse(source, { sourceType: 'unambiguous', plugins: ['typescript', 'jsx'] })
  const result: SnapshotExtraction = { snapshots: [], rejected: [] }
  let inline = 0
  function accept(key: string, value: unknown, owner: StaticNode) {
    const start = owner.start ?? 0
    const end = owner.end ?? source.length
    try {
      const literal = staticString(value)
      assert.ok(literal !== undefined, 'Snapshot contains a dynamic expression')
      const decoded = format === 'literal' ? literal : decodeJestSnapshot(literal)
      const templates = format === 'jest-files' ? fileSections(decoded, files!) : [{ source: decoded, section: undefined }]
      if (format !== 'jest-files') {
        assert.ok(/^\s*<(?:[a-z_][\w:.-]*(?:\s|\/?>)|!--|!\[CDATA\[)/i.test(decoded), 'Snapshot is not an isolated markup template')
      }
      result.snapshots.push(...templates.map(template => ({ key, source: template.source, start, end, ...(template.section ? { section: template.section } : {}) })))
    }
    catch (error) {
      result.rejected.push({ key, start, end, reason: error instanceof Error ? error.message : String(error) })
    }
  }
  function visit(value: unknown) {
    const selected = node(value)
    if (!selected) {
      return
    }
    if (selected.type === 'AssignmentExpression') {
      const left = node(selected.left)
      const object = node(left?.object)
      if (left?.type === 'MemberExpression' && object?.type === 'Identifier' && object.name === 'exports') {
        const key = memberProperty(left)
        if (key !== undefined) {
          accept(key, selected.right, selected)
        }
      }
    }
    if (selected.type === 'CallExpression') {
      const callee = node(selected.callee)
      if (callee?.type === 'MemberExpression' && memberProperty(callee) === 'toMatchInlineSnapshot' && Array.isArray(selected.arguments)) {
        accept(`inline-${++inline}`, selected.arguments[0], selected)
      }
    }
    for (const [key, child] of Object.entries(selected)) {
      if (key === 'loc' || key === 'comments' || key === 'tokens') {
        continue
      }
      if (Array.isArray(child)) {
        child.forEach(visit)
      }
      else {
        visit(child)
      }
    }
  }
  visit(ast)
  return result
}

export function expectedSnapshotsToDocuments(extraction: SnapshotExtraction, identity: GenerationIdentity, file: string, profileId: string, format: SnapshotFormat = 'jest', keys?: readonly string[]): CorpusDocument[] {
  validateGenerationIdentity(identity)
  assert.ok(file && !file.startsWith('/') && !file.includes('\\') && !file.split('/').includes('..'), 'Nonportable upstream snapshot path')
  const profile = getCorpusProfile(profileId)
  assert.ok(keys === undefined || (Array.isArray(keys) && keys.length && keys.every(key => typeof key === 'string' && extraction.snapshots.some(snapshot => snapshot.key === key))), 'Unknown selected static snapshot key')
  return extraction.snapshots.filter(snapshot => !keys || keys.includes(snapshot.key)).map(snapshot => ({
    source: snapshot.source,
    sha256: corpusHash(snapshot.source),
    origins: [{
      ...identity,
      path: file,
      platform: profile.platform,
      profileId,
      category: 'expected',
      expectation: 'valid',
      snapshot: { format, key: snapshot.key, start: snapshot.start, end: snapshot.end, ...(snapshot.section ? { section: snapshot.section } : {}) },
      evidence: [`static-snapshot-key:${snapshot.key}`, `snapshot-utf16:${snapshot.start}:${snapshot.end}`, `snapshot-format:${format}`, ...(snapshot.section ? [`snapshot-file:${snapshot.section.path}`, `snapshot-file-utf16:${snapshot.section.start}:${snapshot.section.end}`] : [])],
    }],
  }))
}
