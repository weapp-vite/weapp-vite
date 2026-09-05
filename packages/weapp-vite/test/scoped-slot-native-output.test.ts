import { fs } from '@weapp-core/shared/fs'
import { parse, traverse } from '@weapp-vite/ast'
import path from 'pathe'
import { createTempFixtureProject, createTestCompilerContext, getFixture, scanFiles } from './utils'

const TEXT_OUTPUT_RE = /\.(?:js|json|wxml|wxss)$/
const RUNTIME_VENDOR_RE = /^weapp-vendors\//

function normalizeOutputContent(file: string, content: string) {
  const value = file.endsWith('.json')
    ? `${JSON.stringify(JSON.parse(content), null, 2)}\n`
    : content
  return value.replace(/scoped-slot-[\w-]+-default-0/g, 'scoped-slot-hash-default-0')
}

describe('scoped slot native output snapshots', () => {
  const fixtureSource = getFixture('scoped-slot-native-output')
  let cleanup: (() => Promise<void>) | undefined
  let distDir = ''

  beforeAll(async () => {
    const tempProject = await createTempFixtureProject(fixtureSource, 'scoped-slot-native-output')
    cleanup = tempProject.cleanup
    distDir = path.join(tempProject.tempDir, 'dist')

    const { ctx, dispose } = await createTestCompilerContext({
      cwd: tempProject.tempDir,
    })
    try {
      await ctx.buildService.build()
    }
    finally {
      await dispose()
    }
  }, 30_000)

  afterAll(async () => {
    await cleanup?.()
  })

  it('locks the emitted file tree and app text outputs', async () => {
    const files = await scanFiles(distDir)
    const appFiles = files.filter(file => !RUNTIME_VENDOR_RE.test(file))
    const runtimeVendorFiles = files.filter(file => RUNTIME_VENDOR_RE.test(file))

    expect(appFiles).toMatchSnapshot('file-tree')
    expect(files.filter(file => file.includes('__scoped-slot-default'))).toEqual([
      'pages/index/index.__scoped-slot-default-0.js',
      'pages/index/index.__scoped-slot-default-0.json',
      'pages/index/index.__scoped-slot-default-0.wxml',
    ])

    const outputSnapshot: Record<string, string> = {}
    const scripts: Record<string, string> = {}
    const requiredVendors = new Set<string>()
    for (const file of files) {
      if (!TEXT_OUTPUT_RE.test(file)) {
        continue
      }
      const content = await fs.readFile(path.join(distDir, file), 'utf-8')
      if (file.endsWith('.js')) {
        scripts[file] = content
        traverse(parse(content), {
          CallExpression({ node }) {
            const request = node.arguments[0]
            if (node.callee.type !== 'Identifier' || node.callee.name !== 'require'
              || request?.type !== 'StringLiteral' || !request.value.startsWith('.')) {
              return
            }
            const resolved = path.join(path.dirname(file), request.value)
            const target = path.extname(resolved) ? resolved : `${resolved}.js`
            expect(files, `${file} requires ${request.value}`).toContain(target)
            if (RUNTIME_VENDOR_RE.test(target)) {
              requiredVendors.add(target)
            }
          },
        })
      }
      else if (!RUNTIME_VENDOR_RE.test(file)) {
        outputSnapshot[file] = normalizeOutputContent(file, content)
      }
    }

    expect([...requiredVendors].sort()).toEqual(runtimeVendorFiles.sort())
    expect(outputSnapshot).toMatchSnapshot('text-outputs')
    expect(outputSnapshot['pages/index/index.wxml']).toContain('generic:scoped-slots-default')
    expect(scripts['pages/index/index.__scoped-slot-default-0.js']).toContain(
      'this.__wvOwnerProxy.tabItems',
    )
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.wxml']).toContain(
      '<van-tabbar-item wx:for="{{__wv_bind_0}}"',
    )
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.wxml']).toContain(
      'name="{{__wv_item_0.to.name}}"',
    )
    expect(outputSnapshot['pages/index/index.__scoped-slot-default-0.wxml']).toContain(
      '>{{__wv_item_0.label}}</van-tabbar-item>',
    )
  })
})
