import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import {
  validateSupportMatrixConsistency,
  WEAPI_METHOD_SUPPORT_MATRIX,
  WEAPI_PLATFORM_SUPPORT_MATRIX,
} from '../src/core/methodMapping.ts'

interface Marker {
  start: string
  end: string
}

const ROOT_DIR = path.resolve(import.meta.dirname, '..')

const README_MATRIX_MARKER: Marker = {
  start: '<!-- @generated weapi-support-matrix:start -->',
  end: '<!-- @generated weapi-support-matrix:end -->',
}

const TYPES_METHOD_DOC_MARKER: Marker = {
  start: '  // @generated weapi-method-docs:start',
  end: '  // @generated weapi-method-docs:end',
}

const PLATFORM_MATRIX_MARKER: Marker = {
  start: ' * @generated weapi-platform-matrix:start',
  end: ' * @generated weapi-platform-matrix:end',
}

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    check: args.includes('--check'),
  }
}

function withIndent(line: string, indent: string) {
  return line ? `${indent}${line}` : indent.trimEnd()
}

function resolveIndent(content: string, marker: Marker) {
  const startToken = marker.start
  const markerIndex = content.indexOf(startToken)
  if (markerIndex === -1) {
    throw new Error(`Marker start not found: ${startToken}`)
  }
  const lineStart = content.lastIndexOf('\n', markerIndex)
  const segment = content.slice(lineStart + 1, markerIndex)
  const match = segment.match(/^[ \t]*/)
  return match?.[0] ?? ''
}

function replaceBetween(content: string, marker: Marker, inner: string) {
  const startIndex = content.indexOf(marker.start)
  if (startIndex === -1) {
    throw new Error(`Marker start not found: ${marker.start}`)
  }
  const endIndex = content.indexOf(marker.end)
  if (endIndex === -1) {
    throw new Error(`Marker end not found: ${marker.end}`)
  }
  if (endIndex < startIndex) {
    throw new Error(`Marker order invalid: ${marker.start} -> ${marker.end}`)
  }
  const before = content.slice(0, startIndex + marker.start.length)
  const after = content.slice(endIndex)
  return `${before}\n${inner}\n${after}`
}

function formatTsdocPlatformMatrix(indent: string, withAlignment: boolean) {
  const header = withAlignment
    ? `${indent}* | 平台 | 全局对象 | 类型来源 | 对齐状态 |`
    : `${indent}* | 平台 | 类型来源 | 支持度 |`
  const divider = withAlignment
    ? `${indent}* | --- | --- | --- | --- |`
    : `${indent}* | --- | --- | --- |`
  const rows = WEAPI_PLATFORM_SUPPORT_MATRIX.map((item) => {
    if (withAlignment) {
      return `${indent}* | ${item.platform} | ${item.globalObject} | ${item.typeSource} | ${item.support} |`
    }
    if (item.globalObject === '运行时宿主对象') {
      return `${indent}* | 其他平台对象 (\`tt/swan/jd/xhs/...\`) | 运行时对象透传 | ${item.support} |`
    }
    return `${indent}* | ${item.platform} (${item.globalObject}) | ${item.typeSource} | ${item.support} |`
  })
  return [header, divider, ...rows].join('\n')
}

function formatMethodDocs(indent: string) {
  const sections: string[] = []
  for (const item of WEAPI_METHOD_SUPPORT_MATRIX) {
    sections.push(
      `${indent}/**`,
      `${indent} * ${item.description}`,
      `${indent} *`,
      `${indent} * | 平台 | 对齐策略 | 支持度 |`,
      `${indent} * | --- | --- | --- |`,
      `${indent} * | 微信 | ${item.wxStrategy} | ${item.support} |`,
      `${indent} * | 支付宝 | ${item.alipayStrategy} | ${item.support} |`,
      `${indent} */`,
      `${indent}${item.method}: WeapiCrossPlatformAdapter['${item.method}']`,
      '',
    )
  }
  while (sections.length > 0 && sections[sections.length - 1] === '') {
    sections.pop()
  }
  return sections.join('\n')
}

async function syncReadme(check: boolean) {
  const filePath = path.join(ROOT_DIR, 'README.md')
  const original = await fs.readFile(filePath, 'utf8')
  const indent = resolveIndent(original, README_MATRIX_MARKER)
  const readmeInner = [
    withIndent('### 平台类型对齐矩阵', indent),
    '',
    withIndent('| 平台 | 全局对象 | 类型来源 | 支持度 |', indent),
    withIndent('| --- | --- | --- | --- |', indent),
    ...WEAPI_PLATFORM_SUPPORT_MATRIX.map(item => withIndent(`| ${item.platform} | ${item.globalObject} | ${item.typeSource} | ${item.support} |`, indent)),
    '',
    withIndent('### 核心跨端映射矩阵', indent),
    '',
    withIndent('| API | 说明 | 微信策略 | 支付宝策略 | 支持度 |', indent),
    withIndent('| --- | --- | --- | --- | --- |', indent),
    ...WEAPI_METHOD_SUPPORT_MATRIX.map(item =>
      withIndent(`| \`${item.method}\` | ${item.description} | ${item.wxStrategy} | ${item.alipayStrategy} | ${item.support} |`, indent),
    ),
  ].join('\n')
  const next = replaceBetween(original, README_MATRIX_MARKER, readmeInner)
  if (check) {
    if (next !== original) {
      throw new Error('README 支持矩阵未同步，请先运行 pnpm --filter @wevu/api docs:sync')
    }
    return
  }
  if (next !== original) {
    await fs.writeFile(filePath, next)
  }
}

function replacePlatformMatrixInComment(content: string, marker: Marker, withAlignment: boolean) {
  const indent = marker.start.startsWith(' * ') ? ' ' : resolveIndent(content, marker)
  const matrix = formatTsdocPlatformMatrix(indent, withAlignment)
  return replaceBetween(content, marker, matrix)
}

async function syncTypeSources(check: boolean) {
  const typesSourcePath = path.join(ROOT_DIR, 'src/core/types.ts')
  const indexSourcePath = path.join(ROOT_DIR, 'src/index.ts')
  const declarationPath = path.join(ROOT_DIR, 'types/index.d.ts')

  const typesSourceOriginal = await fs.readFile(typesSourcePath, 'utf8')
  const methodsDoc = formatMethodDocs('  ')
  const typesWithMethods = replaceBetween(typesSourceOriginal, TYPES_METHOD_DOC_MARKER, methodsDoc)
  const typesNext = replacePlatformMatrixInComment(typesWithMethods, PLATFORM_MATRIX_MARKER, true)

  const indexSourceOriginal = await fs.readFile(indexSourcePath, 'utf8')
  const indexNext = replacePlatformMatrixInComment(indexSourceOriginal, PLATFORM_MATRIX_MARKER, false)

  const declarationOriginal = await fs.readFile(declarationPath, 'utf8')
  const declarationNext = replacePlatformMatrixInComment(declarationOriginal, PLATFORM_MATRIX_MARKER, true)

  if (check) {
    const outdated = [
      { name: 'src/core/types.ts', changed: typesNext !== typesSourceOriginal },
      { name: 'src/index.ts', changed: indexNext !== indexSourceOriginal },
      { name: 'types/index.d.ts', changed: declarationNext !== declarationOriginal },
    ].filter(item => item.changed)
    if (outdated.length > 0) {
      throw new Error(`支持矩阵文档未同步：${outdated.map(item => item.name).join(', ')}`)
    }
    return
  }

  if (typesNext !== typesSourceOriginal) {
    await fs.writeFile(typesSourcePath, typesNext)
  }
  if (indexNext !== indexSourceOriginal) {
    await fs.writeFile(indexSourcePath, indexNext)
  }
  if (declarationNext !== declarationOriginal) {
    await fs.writeFile(declarationPath, declarationNext)
  }
}

function ensureMatrixConsistency() {
  const { missingDocs, missingMappings } = validateSupportMatrixConsistency()
  if (missingDocs.length > 0 || missingMappings.length > 0) {
    const lines = ['weapi 支持矩阵与映射规则不一致：']
    if (missingDocs.length > 0) {
      lines.push(`- 缺少文档方法：${missingDocs.join(', ')}`)
    }
    if (missingMappings.length > 0) {
      lines.push(`- 缺少映射规则方法：${missingMappings.join(', ')}`)
    }
    throw new Error(lines.join('\n'))
  }
}

async function run() {
  const { check } = parseArgs()
  ensureMatrixConsistency()
  await syncReadme(check)
  await syncTypeSources(check)
}

run().catch((error) => {
  console.error('[weapi-support-matrix] sync failed')
  console.error(error)
  process.exitCode = 1
})
