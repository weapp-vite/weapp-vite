import type { NodePath } from '@babel/traverse'
import type { CallExpression } from '@babel/types'
import type { VueTransformResult } from 'wevu/compiler'
import type { ModuleMeta, ResolveWebAutoImportTag, ResolveWebModuleId, ScanState } from './types'
import { parse } from '@babel/parser'
import _babelTraverse from '@babel/traverse'
import * as t from '@babel/types'
import { fs } from '@weapp-core/shared/fs'
import { transform } from 'esbuild'
import MagicString from 'magic-string'
import path from 'pathe'
import { compileVueFile, isUniAppCompatibilityFile, transformUniAppSource } from 'wevu/compiler'
import { compileWxml } from '../compiler/wxml'
import { resolveScriptFile } from './files'
import { appendInlineQuery, resolveTemplatePathSync, resolveWxsPathSync, toRelativeImport } from './path'

type TraverseFunction = typeof _babelTraverse extends (...args: any[]) => any
  ? typeof _babelTraverse
  : typeof _babelTraverse extends { default: infer D }
    ? D
    : typeof _babelTraverse

const traverse: TraverseFunction = typeof _babelTraverse === 'function'
  ? _babelTraverse
  : (_babelTraverse as any).default

async function resolveSfcSrc(
  request: string,
  importer: string,
  srcRoot: string,
  resolveId?: ResolveWebModuleId,
) {
  if (request.startsWith('@/')) {
    return path.resolve(srcRoot, request.slice(2))
  }
  if (request.startsWith('.')) {
    return path.resolve(path.dirname(importer), request)
  }
  if (request.startsWith('/')) {
    return path.resolve(srcRoot, request.slice(1))
  }
  return await resolveId?.(request, importer)
}

export async function compileWebVueSfc(options: {
  source: string
  filename: string
  meta: ModuleMeta
  srcRoot: string
  state: ScanState
  resolveId?: ResolveWebModuleId
  resolveAutoImportTag?: ResolveWebAutoImportTag
  uniApp?: { include: string[] }
}) {
  const { filename, meta, srcRoot, state, resolveId, resolveAutoImportTag, uniApp } = options
  const source = uniApp && isUniAppCompatibilityFile(filename, srcRoot, uniApp.include)
    ? transformUniAppSource(options.source, { filename, target: 'h5' }).code
    : options.source
  const result = await compileVueFile(source, filename, {
    isApp: meta.kind === 'app',
    isPage: meta.kind === 'page',
    sourceMap: false,
    style: {
      preserveDeepSelectors: true,
    },
    json: { kind: meta.kind },
    autoUsingComponents: {
      enabled: true,
      resolveUsingComponentPath: async (request, importer) => {
        const base = request.startsWith('@/')
          ? path.resolve(srcRoot, request.slice(2))
          : request.startsWith('.')
            ? path.resolve(path.dirname(importer), request)
            : request.startsWith('/')
              ? path.resolve(srcRoot, request.slice(1))
              : undefined
        if (!base) {
          return undefined
        }
        const resolvedId = await resolveScriptFile(base)
        if (!resolvedId) {
          return undefined
        }
        return {
          from: request,
          resolvedId,
          sourceType: resolvedId.endsWith('.vue') ? 'wevu-sfc' : 'native',
        }
      },
    },
    autoImportTags: {
      enabled: Boolean(resolveAutoImportTag),
      resolveUsingComponent: async (tag, importer) => resolveAutoImportTag?.(tag, importer),
    },
    sfcSrc: {
      resolveId: async (request, importer) => {
        return resolveSfcSrc(request, importer ?? filename, srcRoot, resolveId)
      },
    },
  })
  state.sfcResults.set(filename, result)
  for (const dependency of result.meta?.sfcSrcDeps ?? []) {
    state.templatePathSet.add(dependency)
  }
  return result
}

export async function ensureWebVueSfcResult(options: {
  filename: string
  meta: ModuleMeta
  srcRoot: string
  state: ScanState
  source?: string
  resolveId?: ResolveWebModuleId
  resolveAutoImportTag?: ResolveWebAutoImportTag
  uniApp?: { include: string[] }
}) {
  const cached = options.state.sfcResults.get(options.filename)
  if (cached) {
    return cached
  }
  const source = options.source ?? await fs.readFile(options.filename, 'utf8')
  return await compileWebVueSfc({ ...options, source })
}

function getSfcRegisterName(kind: ModuleMeta['kind']) {
  return kind === 'app' ? 'registerWebWevuApp' : 'registerWebWevuComponent'
}

function getSfcFactoryName(kind: ModuleMeta['kind']) {
  return kind === 'app' ? 'createApp' : 'createWevuComponent'
}

function createRegisterMetaCode(meta: ModuleMeta, templateIdent?: string, styleIdent?: string) {
  const parts = [`id: ${JSON.stringify(meta.id)}`, `kind: ${JSON.stringify(meta.kind)}`]
  if (templateIdent) {
    parts.push(`template: ${templateIdent}`)
  }
  if (styleIdent) {
    parts.push(`style: ${styleIdent}`)
  }
  if (meta.navigationBar) {
    parts.push(`navigationBar: ${JSON.stringify(meta.navigationBar)}`)
  }
  return `{ ${parts.join(', ')} }`
}

export async function transformWebVueSfcScript(options: {
  code: string
  filename: string
  meta: ModuleMeta
  runtimeModuleId: string
  styleLanguage: string
  enableHmr: boolean
  hmrAcceptCode?: string
}) {
  const { code, filename, meta, runtimeModuleId, styleLanguage, enableHmr, hmrAcceptCode } = options
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    ranges: true,
  })
  const s = new MagicString(code)
  const templateIdent = meta.kind === 'app' ? undefined : '__weapp_sfc_template__'
  const styleIdent = meta.kind === 'app' ? undefined : '__weapp_sfc_style__'
  const registerName = getSfcRegisterName(meta.kind)
  const factoryName = getSfcFactoryName(meta.kind)
  const registerMetaCode = createRegisterMetaCode(meta, templateIdent, styleIdent)
  let transformed = false

  traverse(ast, {
    CallExpression(nodePath: NodePath<CallExpression>) {
      const callee = nodePath.node.callee
      if (!t.isIdentifier(callee, { name: factoryName })) {
        return
      }
      s.overwrite(callee.start!, callee.end!, registerName)
      s.appendLeft(nodePath.node.end! - 1, `, ${registerMetaCode}`)
      transformed = true
    },
  })

  if (!transformed) {
    throw new Error(`[@weapp-vite/web] Vue SFC 未生成 ${factoryName} 注册调用: ${filename}`)
  }

  const imports = [`import { ${registerName} } from '${runtimeModuleId}'`]
  if (templateIdent) {
    imports.push(`import ${templateIdent} from '${toRelativeImport(filename, filename)}?weapp-web-sfc-template'`)
  }
  if (styleIdent) {
    const styleFilename = `${filename}.${styleLanguage}`
    imports.push(`import ${styleIdent} from '${appendInlineQuery(`${toRelativeImport(filename, styleFilename)}?weapp-web-sfc-style`)}'`)
  }
  s.prepend(`${imports.join('\n')}\n`)
  if (enableHmr && hmrAcceptCode) {
    s.append(`\n${hmrAcceptCode}\n`)
  }
  const transpiled = await transform(s.toString(), {
    format: 'esm',
    legalComments: 'inline',
    loader: 'ts',
    sourcefile: filename,
    sourcemap: 'external',
    target: 'es2022',
  })
  return {
    code: transpiled.code,
    map: transpiled.map ? JSON.parse(transpiled.map) : null,
  }
}

export function generateWebVueSfcTemplate(
  result: VueTransformResult,
  meta: ModuleMeta,
  filename: string,
  srcRoot: string,
) {
  const compiled = compileWxml({
    id: filename,
    source: result.template ?? '',
    navigationBar: meta.navigationBar ? { config: meta.navigationBar } : undefined,
    componentTags: meta.componentTags,
    resolveTemplatePath: (request, importer) => resolveTemplatePathSync(request, importer, srcRoot),
    resolveWxsPath: (request, importer) => resolveWxsPathSync(request, importer, srcRoot),
  })
  return compiled
}

export function resolveWebVueSfcStyleLanguage(result: VueTransformResult, filename: string) {
  const languages = new Set(
    (result.meta?.styleBlocks ?? []).map(style => style.lang?.trim() || 'css'),
  )
  if (languages.size > 1) {
    throw new Error(`[@weapp-vite/web] Vue SFC 暂不支持混合样式语言: ${filename}`)
  }
  const language = languages.values().next().value ?? 'css'
  if (!/^[a-z][a-z0-9-]*$/i.test(language)) {
    throw new Error(`[@weapp-vite/web] Vue SFC 样式语言无效: ${filename} -> ${language}`)
  }
  return language
}

export function generateWebVueSfcStyle(result: VueTransformResult) {
  return result.style ?? ''
}
