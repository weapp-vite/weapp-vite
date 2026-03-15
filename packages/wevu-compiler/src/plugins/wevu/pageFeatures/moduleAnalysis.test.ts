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
    const source = `export function useA() {}`
    const fromCode = createModuleAnalysisFromCode('/project/src/page.ts', source, {
      astEngine: 'oxc',
    })

    expect(fromCode.id).toBe('/project/src/page.ts')

    const babelCached = getOrCreateExternalModuleAnalysis('/virtual/a.ts', source, {
      astEngine: 'babel',
    })
    const oxcCached = getOrCreateExternalModuleAnalysis('/virtual/a.ts', source, {
      astEngine: 'oxc',
    })

    expect(babelCached).not.toBe(oxcCached)
  })
})
