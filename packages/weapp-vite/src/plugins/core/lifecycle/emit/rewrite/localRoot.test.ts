import type { OutputAsset, OutputBundle, OutputChunk } from 'rolldown'
import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { rewriteBundleNpmImportsToLocalRoots } from './localRoot'

function createChunk(fileName: string, code: string): OutputChunk {
  return {
    code,
    dynamicImports: [],
    exports: [],
    facadeModuleId: null,
    fileName,
    imports: [],
    isDynamicEntry: false,
    isEntry: false,
    isImplicitEntry: false,
    map: null,
    moduleIds: [],
    modules: {},
    name: fileName,
    preliminaryFileName: fileName,
    sourcemapFileName: null,
    type: 'chunk',
  } as unknown as OutputChunk
}

function createJsonAsset(fileName: string, usingComponents: Record<string, string>): OutputAsset {
  return {
    fileName,
    name: undefined,
    needsCodeReference: false,
    originalFileNames: [],
    source: `${JSON.stringify({ usingComponents })}\n`,
    type: 'asset',
  } as unknown as OutputAsset
}

describe('rewriteBundleNpmImportsToLocalRoots', () => {
  it('rewrites main and subpackage npm imports in one bundle pass', () => {
    const main = createChunk('pages/index.js', `const comp = require('ui-lib/button')`)
    const sub = createChunk('pkg-a/pages/index.js', `const comp = require('ui-lib/button')`)
    const untouchedSub = createChunk('pkg-b/pages/index.js', `const comp = require('ui-lib/button')`)
    const mainJson = createJsonAsset('pages/index.json', {
      button: 'ui-lib/button',
    })
    const subJson = createJsonAsset('pkg-a/pages/index.json', {
      button: 'ui-lib/button',
    })
    const bundle: OutputBundle = {
      [main.fileName]: main,
      [sub.fileName]: sub,
      [untouchedSub.fileName]: untouchedSub,
      [mainJson.fileName]: mainJson,
      [subJson.fileName]: subJson,
    }

    rewriteBundleNpmImportsToLocalRoots(
      bundle,
      {
        'ui-lib': '1.0.0',
      },
      [
        {
          root: 'pkg-a',
          dependencies: ['ui-lib'],
        },
        {
          root: 'pkg-b',
          dependencies: ['other-lib'],
        },
      ],
    )

    expect(main.code).toContain(`require("../miniprogram_npm/ui-lib/button")`)
    expect(sub.code).toContain(`require("../miniprogram_npm/ui-lib/button")`)
    expect(untouchedSub.code).toContain(`require('ui-lib/button')`)
    expect(JSON.parse(String(mainJson.source)).usingComponents.button).toBe('../miniprogram_npm/ui-lib/button')
    expect(JSON.parse(String(subJson.source)).usingComponents.button).toBe('../miniprogram_npm/ui-lib/button')
  })

  it('prefers the most specific subpackage root for nested roots', () => {
    const nested = createChunk('pkg-a/nested/pages/index.js', `const comp = require('ui-lib/button')`)
    const nestedJson = createJsonAsset('pkg-a/nested/pages/index.json', {
      button: 'ui-lib/button',
    })
    const bundle: OutputBundle = {
      [nested.fileName]: nested,
      [nestedJson.fileName]: nestedJson,
    }

    rewriteBundleNpmImportsToLocalRoots(
      bundle,
      {
        'ui-lib': '1.0.0',
      },
      [
        {
          root: 'pkg-a',
          dependencies: ['other-lib'],
        },
        {
          root: 'pkg-a/nested',
          dependencies: ['ui-lib'],
        },
      ],
    )

    expect(nested.code).toContain(`require("../miniprogram_npm/ui-lib/button")`)
    expect(JSON.parse(String(nestedJson.source)).usingComponents.button).toBe('../miniprogram_npm/ui-lib/button')
  })

  it('reuses the same nested root target for matching script and json outputs', () => {
    const nestedScript = createChunk('pkg-a/nested/pages/detail.js', `const comp = require('ui-lib/button')`)
    const nestedJson = createJsonAsset('pkg-a/nested/pages/detail.json', {
      button: 'ui-lib/button',
    })
    const bundle: OutputBundle = {
      [nestedScript.fileName]: nestedScript,
      [nestedJson.fileName]: nestedJson,
    }

    rewriteBundleNpmImportsToLocalRoots(
      bundle,
      {
        'ui-lib': '1.0.0',
      },
      [
        {
          root: 'pkg-a',
          dependencies: ['other-lib'],
        },
        {
          root: 'pkg-a/nested',
          dependencies: ['ui-lib'],
        },
      ],
    )

    expect(nestedScript.code).toContain(`require("../miniprogram_npm/ui-lib/button")`)
    expect(JSON.parse(String(nestedJson.source)).usingComponents.button).toBe('../miniprogram_npm/ui-lib/button')
  })

  it('does not rewrite the subpackage root chunk as a local subpackage page chunk', () => {
    const rootChunk = createChunk('pkg-a', `const comp = require('ui-lib/button')`)
    const pageChunk = createChunk('pkg-a/pages/index.js', `const comp = require('ui-lib/button')`)
    const rootJson = createJsonAsset('pkg-a.json', {
      button: 'ui-lib/button',
    })
    const bundle: OutputBundle = {
      [rootChunk.fileName]: rootChunk,
      [pageChunk.fileName]: pageChunk,
      [rootJson.fileName]: rootJson,
    }

    rewriteBundleNpmImportsToLocalRoots(
      bundle,
      {
        'ui-lib': '1.0.0',
      },
      [
        {
          root: 'pkg-a',
          dependencies: ['ui-lib'],
        },
      ],
    )

    expect(rootChunk.code).toContain(`require("./miniprogram_npm/ui-lib/button")`)
    expect(rootChunk.code).not.toContain(`require("./pkg-a/miniprogram_npm/ui-lib/button")`)
    expect(pageChunk.code).toContain(`require("../miniprogram_npm/ui-lib/button")`)
    expect(JSON.parse(String(rootJson.source)).usingComponents.button).toBe('./miniprogram_npm/ui-lib/button')
  })

  it('keeps chunk sourcemap empty when sourcemaps are disabled', () => {
    const chunk = createChunk('subpackages/item/pages/index.js', `const comp = require('ui-lib/button')`)
    const bundle: OutputBundle = {
      [chunk.fileName]: chunk,
    }

    rewriteBundleNpmImportsToLocalRoots(
      bundle,
      {
        'ui-lib': '1.0.0',
      },
      [
        {
          root: 'subpackages/item',
          dependencies: ['ui-lib'],
        },
      ],
    )

    expect(chunk.code).toContain(`require("../miniprogram_npm/ui-lib/button")`)
    expect(chunk.map).toBeNull()
  })

  it('updates sourcemaps when rewriting local npm imports in chunks', () => {
    const code = [
      `var require_camelcase = require("camelcase");`,
      `var import_camelcase = __toESM(require_camelcase, 1);`,
      `const issue769NpmMarker = (0, import_camelcase.default)("issue 769 sourcemap marker");`,
      `Page({ data: { issue769NpmMarker } });`,
    ].join('\n')
    const source = 'src/subpackages/item/issue-769/index.ts'
    const chunk = createChunk('subpackages/item/issue-769/index.js', code)
    const originalMap = new MagicString(code).generateMap({
      hires: 'boundary',
      includeContent: true,
      source,
    })
    chunk.map = originalMap as any
    const bundle: OutputBundle = {
      [chunk.fileName]: chunk,
    }

    rewriteBundleNpmImportsToLocalRoots(
      bundle,
      {
        camelcase: '9.0.0',
      },
      [
        {
          root: 'subpackages/item',
          dependencies: ['camelcase'],
        },
      ],
    )

    expect(chunk.code).toContain(`require("../miniprogram_npm/camelcase/index")`)
    expect(chunk.code).toContain(`__toESM(require_camelcase)`)
    expect(chunk.code).not.toContain(`__toESM(require_camelcase,)`)
    expect(chunk.map).not.toBe(originalMap)
    expect(chunk.map?.sources).toContain(source)
    expect(chunk.map?.sourcesContent?.join('\n')).toContain('issue769NpmMarker')
  })
})
