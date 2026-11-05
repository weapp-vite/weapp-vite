import type { Document, EditVisitors, TemplateDocument } from '../../../packages/wxml/src/types'
import type { TemplateApi } from '../assertions'
import type { CoreTemplateModule } from './coreApi'
import type { ApiVariant } from './harness'
import { assertRanges } from '../assertions/ranges'
import { equal, invariant, rejects } from '../assertions/types'

export interface EntryContractReport {
  accepted: boolean
  checks: string[]
  failures: Array<{ check: string, message: string }>
}

interface PathEditingModule extends Pick<CoreTemplateModule, 'compileDialect' | 'createParser' | 'serialize'> {
  edit: <State>(document: TemplateDocument, visitors: EditVisitors<State>, state: State) => TemplateDocument
}

/** 直接检查实际入口，不能用补充了兼容元数据的语料适配视图替代。 */
export function runEntryContracts(module: unknown, apiVariant: ApiVariant): EntryContractReport {
  const report: EntryContractReport = { accepted: true, checks: [], failures: [] }
  const check = (name: string, action: () => void) => {
    report.checks.push(name)
    try {
      action()
    }
    catch (error) {
      report.accepted = false
      report.failures.push({ check: name, message: error instanceof Error ? error.message : String(error) })
    }
  }
  check('public-surface', () => {
    invariant(module !== null && typeof module === 'object', 'entry', 'entry must be a module object')
    for (const name of ['compileDialect', 'createParser', 'decodeAttribute', 'serialize', 'edit', 'walk']) {
      invariant(typeof Reflect.get(module, name) === 'function', 'entry', `missing public function: ${name}`)
    }
    if (apiVariant === 'core') {
      for (const name of ['parse', 'scan', 'scanComments', 'presets', 'weapp', 'getTemplatePreset']) {
        invariant(!Reflect.has(module, name), 'entry', `core exposes compatibility surface: ${name}`)
      }
    }
    else {
      for (const name of ['parse', 'scan', 'scanComments', 'getTemplatePreset']) {
        invariant(typeof Reflect.get(module, name) === 'function', 'entry', `missing root function: ${name}`)
      }
    }
  })
  check('path-editing', () => {
    const api = module as PathEditingModule
    const parser = api.createParser(api.compileDialect({ id: 'path-entry-contract', syntax: 'xml', rawTags: [] }))
    const source = '<root><legacy/></root>'
    const original = parser.parse(source)
    const state = { visits: [] as string[], buttons: 0 }
    const next = api.edit(original, {
      Element: {
        enter(path, state) {
          state.visits.push(path.node.name)
          if (path.isElement('root')) {
            const child = path.get('children')[0]
            invariant(child && child.parentPath === path, 'entry', 'child path lost its parent')
            child.rename('button')
            invariant(child.isElement('button'), 'entry', 'renamed path did not expose its current name')
            const added = path.append('<legacy/>')[0]
            invariant(added && added.originalRange === undefined, 'entry', 'inserted path claimed an original source range')
            added.setAttribute('id', 'new')
            invariant(added.getAttribute('id')?.value === 'new', 'entry', 'inserted path was not immediately editable')
          }
          else {
            if (path.isElement('legacy')) {
              path.rename('button')
            }
            state.buttons++
          }
        },
        exit(path, state) {
          if (path.isElement('root')) {
            invariant(path.get('children').every(child => child.isElement('button')), 'entry', 'exit visitor saw stale child paths')
            path.setAttribute('count', state.buttons)
          }
        },
      },
    }, state)
    equal(state.visits, ['root', 'button', 'legacy'], 'entry', 'inserted paths were not visited once in source order')
    invariant(api.serialize(next) === '<root count="{{2}}"><button/><button id="new"/></root>', 'entry', 'path edits were not committed together')
    invariant(original.source === source && api.serialize(original) === source, 'entry', 'path editing mutated its input')
    equal(next.children, parser.parse(next.source).children, 'entry', 'committed path AST differs from its source')
    assertRanges(next)
  })
  if (apiVariant === 'core') {
    const core = module as CoreTemplateModule
    check('core-document-and-context', () => {
      const dialect = core.compileDialect({ id: 'entry-contract', syntax: 'xml', rawTags: ['opaque'] })
      equal(Object.keys(dialect).sort(), ['id', 'rawTags', 'syntax'], 'entry', 'compiled dialect exposes internal matcher state')
      invariant(Object.isFrozen(dialect) && Object.isFrozen(dialect.rawTags), 'entry', 'compiled dialect is mutable')
      const parser = core.createParser(dialect)
      const source = '<opaque>const fake="<view/>";</opaque>'
      const document = parser.parse(source)
      invariant(!('platform' in document) && !('options' in document), 'entry', 'core document exposes compatibility metadata')
      equal(document.diagnostics, [], 'entry', 'core rejected explicit raw input')
      const element = document.children[0]
      invariant(element?.kind === 'element' && element.children.length === 1 && element.children[0]?.kind === 'script', 'entry', 'explicit raw tag lost ownership')
      const edited = core.edit(document, (handle) => {
        if (handle.node.kind === 'element') {
          handle.setBooleanAttribute('active')
        }
      })
      invariant(!('platform' in edited) && !('options' in edited), 'entry', 'edited core document exposes compatibility metadata')
      invariant(core.serialize(edited) === '<opaque active>const fake="<view/>";</opaque>', 'entry', 'core edit lost parser context')
      rejects(() => core.edit({ ...document }, () => {}), 'entry', 'core accepted a detached document without parser context')
    })
    check('core-explicit-raw-ownership', () => {
      const parser = core.createParser(core.compileDialect({ id: 'entry-no-raw-tags', syntax: 'xml', rawTags: [] }))
      const document = parser.parse('<wxs><view/></wxs>')
      const element = document.children[0]
      invariant(element?.kind === 'element' && element.children[0]?.kind === 'element', 'entry', 'core inferred a platform raw tag')
    })
  }
  else {
    const root = module as TemplateApi
    check('root-default-compatibility', () => {
      const document = root.parse('<wxs>const fake="<view/>";</wxs>')
      invariant(document.platform === 'weapp' && document.syntax === 'legacy', 'entry', 'root default platform or syntax changed')
      const element = document.children[0]
      invariant(element?.kind === 'element' && element.children[0]?.kind === 'script', 'entry', 'root default raw tags changed')
      const restored: Document = { ...document }
      invariant(root.serialize(root.edit(restored, () => {})) === document.source, 'entry', 'root structural document compatibility changed')
    })
    check('root-platform-defaults-and-overrides', () => {
      for (const platform of ['weapp', 'alipay', 'swan', 'tt', 'jd', 'xhs', 'qq', 'ks', 'ty'] as const) {
        const document = root.parse('<view/>', { platform })
        invariant(document.platform === platform && document.syntax === (platform === 'weapp' ? 'legacy' : 'xml'), 'entry', `root defaults changed for ${platform}`)
      }
      const document: TemplateDocument = root.parse('<wxs><view/></wxs>', { syntax: 'xml', rawTags: [] })
      const element = document.children[0]
      invariant(element?.kind === 'element' && element.children[0]?.kind === 'element', 'entry', 'explicit root rawTags no longer replaces defaults')
    })
  }
  return report
}
