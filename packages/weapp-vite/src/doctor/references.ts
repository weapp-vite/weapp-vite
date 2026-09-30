import type { MpPlatform } from '../types'
import type { DoctorArtifactSnapshot, DoctorReport } from './types'
import { posix as path } from 'node:path'
import { parseJsLike, traverse } from '@weapp-vite/ast/babel'
import { Parser } from 'htmlparser2'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import { classifyPackage } from '../analyze/subpackages/classifier'
import { getPlatformOutputExtensions } from '../platform'
import { addDiagnostic } from './report'
import { incompleteCoverage } from './source'

export function checkArtifactReferences(
  report: DoctorReport,
  target: MpPlatform,
  snapshot: DoctorArtifactSnapshot,
  classifier: { subPackageRoots: Set<string>, independentRoots: Set<string> },
) {
  const files = new Set(snapshot.files.map(file => file.path))
  const ext = getPlatformOutputExtensions(target)
  const reference = (owner: string, specifier: string, script = false) => {
    if (/^[a-z]+:\/\//i.test(specifier) || specifier.includes('{{')) {
      incompleteCoverage(report, target, 'artifact', 'references', '动态或外部引用不能由本地静态快照验证。')
      return
    }
    const base = path.normalize(specifier.startsWith('/') ? specifier.slice(1) : path.join(path.dirname(owner), specifier))
    const candidates = script
      ? [base, `${base}.js`, `${base}.json`, `${base}/index.js`]
      : [base]
    const found = candidates.find(candidate => files.has(candidate))
    const from = classifyPackage(owner, 'main', classifier)
    const to = found && classifyPackage(found, 'main', classifier)
    const crosses = to && ((from.type === 'independent' && from.id !== to.id) || (to.type !== 'main' && from.id !== to.id))
    if (!found || crosses) {
      addDiagnostic(report, {
        ruleId: `doctor/artifact/${crosses ? 'package-import' : 'missing-import'}`,
        target,
        layer: 'artifact',
        severity: 'error',
        message: crosses ? '产物引用跨越包边界' : '产物引用指向不存在的文件',
        location: { file: owner },
        evidence: { expected: '引用可在所属包及允许的依赖范围内解析', actual: specifier },
        responsibility: { owner: 'unknown', confidence: 'confirmed' },
        suggestion: '检查最终产物路径、native npm 输出目录及独立分包归属；不要只修改源码导入规避编译器问题。',
      })
    }
  }
  for (const file of snapshot.files) {
    if (file.text === undefined) {
      continue
    }
    try {
      if (file.path.endsWith(`.${ext.js}`)) {
        const ast = parseJsLike(file.text)
        traverse(ast, {
          ImportDeclaration(p) { reference(file.path, p.node.source.value, true) },
          ExportNamedDeclaration(p) {
            if (p.node.source) {
              reference(file.path, p.node.source.value, true)
            }
          },
          ExportAllDeclaration(p) { reference(file.path, p.node.source.value, true) },
          CallExpression(p) {
            if (!p.get('callee').isIdentifier({ name: 'require' }) || p.scope.getBinding('require')) {
              return
            }
            const arg = p.node.arguments[0]
            if (arg?.type === 'StringLiteral') {
              reference(file.path, arg.value, true)
            }
            else {
              incompleteCoverage(report, target, 'artifact', 'dynamic-import', '动态 require 无法由静态快照解析。')
            }
          },
        })
      }
      else if (file.path.endsWith(`.${ext.wxml}`)) {
        const parser = new Parser({
          onopentag(name, attributes) {
            if (['import', 'include', 'wxs', 'sjs', 'import-sjs'].includes(name) && attributes.src) {
              reference(file.path, attributes.src)
            }
          },
        }, { xmlMode: true })
        parser.end(file.text)
      }
      else if (file.path.endsWith(`.${ext.wxss}`)) {
        postcss.parse(file.text).walkAtRules('import', (rule) => {
          const first = valueParser(rule.params).nodes[0]
          const value = first?.type === 'string' ? first.value : undefined
          if (value) {
            reference(file.path, value)
          }
          else {
            incompleteCoverage(report, target, 'artifact', 'style-import', '非字符串样式导入需要目标宿主或适配器验证。')
          }
        })
      }
    }
    catch {
      incompleteCoverage(report, target, 'artifact', 'reference-parse', '产物无法解析，未将引用图视为完整。')
    }
  }
  report.coverage.push({ target, layer: 'artifact', check: 'static-references', status: 'complete', reason: '覆盖静态脚本、模板和样式引用；动态/外部引用另记 incomplete。' })
}
