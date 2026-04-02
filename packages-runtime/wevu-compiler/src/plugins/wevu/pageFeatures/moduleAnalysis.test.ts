import { describe, expect, it } from 'vitest'
import { parseJsLike } from '../../../utils/babel'
import { createModuleAnalysis, createModuleAnalysisFromCode, getOrCreateExternalModuleAnalysis } from './moduleAnalysis'

describe('moduleAnalysis', () => {
  it('collects imports, locals and exports from module AST', () => {
    const source = `
import { onShareTimeline as onTimeline, defineComponent } from 'wevu'
import * as wevu from 'wevu'
import helper from './helper'
import { named as alias } from './named'

function localFn() {}
const localArrow = () => {}

export { localFn as renamed, alias as aliasExport }
export { ext as extName } from './ext'
export default function defaultFn() {}
    `.trim()

    const analysis = createModuleAnalysis('/project/src/page.ts', parseJsLike(source))

    expect(analysis.wevuNamedHookLocals.get('onTimeline')).toBe('enableOnShareTimeline')
    expect(analysis.wevuNamespaceLocals.has('wevu')).toBe(true)
    expect(analysis.importedBindings.get('helper')).toMatchObject({
      kind: 'default',
      source: './helper',
    })
    expect(analysis.importedBindings.get('alias')).toMatchObject({
      kind: 'named',
      source: './named',
      importedName: 'named',
    })
    expect(analysis.localFunctions.has('localFn')).toBe(true)
    expect(analysis.localFunctions.has('localArrow')).toBe(true)
    expect(analysis.exports.get('renamed')).toMatchObject({
      type: 'local',
      localName: 'localFn',
    })
    expect(analysis.exports.get('extName')).toMatchObject({
      type: 'reexport',
      source: './ext',
      importedName: 'ext',
    })
    expect(analysis.exports.get('default')).toMatchObject({
      type: 'local',
      localName: 'defaultFn',
    })
  })

  it('reuses cached external module analysis for same module and code', () => {
    const codeA = `export function useA() {}`
    const codeB = `export function useB() {}`
    const moduleId = '/virtual/a.ts'

    const a1 = getOrCreateExternalModuleAnalysis(moduleId, codeA)
    const a2 = getOrCreateExternalModuleAnalysis(moduleId, codeA)
    const b = getOrCreateExternalModuleAnalysis(moduleId, codeB)

    expect(a1).toBe(a2)
    expect(b).not.toBe(a1)
  })

  it('creates module analysis from source with ast engine option and keeps cache isolated by engine', () => {
    const source = `
import { onPageScroll as onScroll } from 'wevu'
export function useA() {
  onScroll()
}
    `.trim()
    const fromCode = createModuleAnalysisFromCode('/project/src/page.ts', source, {
      astEngine: 'oxc',
    })

    expect(fromCode.id).toBe('/project/src/page.ts')
    expect(fromCode.engine).toBe('oxc')
    expect(fromCode.ast).toBeUndefined()
    expect(fromCode.wevuNamedHookLocals.get('onScroll')).toBe('enableOnPageScroll')
    expect(fromCode.localFunctions.has('useA')).toBe(true)
    expect(fromCode.exports.get('useA')).toMatchObject({
      type: 'local',
      localName: 'useA',
    })

    const babelCached = getOrCreateExternalModuleAnalysis('/virtual/a.ts', source, {
      astEngine: 'babel',
    })
    const oxcCached = getOrCreateExternalModuleAnalysis('/virtual/a.ts', source, {
      astEngine: 'oxc',
    })

    expect(babelCached).not.toBe(oxcCached)
  })

  it('fast rejects source without module syntax when ast engine is oxc', () => {
    const source = `
const count = 1
function localOnly() {
  return count
}
    `.trim()

    const result = createModuleAnalysisFromCode('/project/src/local.ts', source, {
      astEngine: 'oxc',
    })

    expect(result.engine).toBe('oxc')
    expect(result.ast).toBeUndefined()
    expect(result.importedBindings.size).toBe(0)
    expect(result.localFunctions.size).toBe(0)
    expect(result.exports.size).toBe(0)
  })

  it('reuses createModuleAnalysisFromCode cache for identical source and engine', () => {
    const source = `
import { onPageScroll } from 'wevu'
export function usePage() {
  onPageScroll()
}
    `.trim()

    const a = createModuleAnalysisFromCode('/project/src/page.ts', source, {
      astEngine: 'oxc',
    })
    const b = createModuleAnalysisFromCode('/project/src/page.ts', source, {
      astEngine: 'oxc',
    })
    const babel = createModuleAnalysisFromCode('/project/src/page.ts', source, {
      astEngine: 'babel',
    })

    expect(a).toBe(b)
    expect(a).not.toBe(babel)
  })
})
