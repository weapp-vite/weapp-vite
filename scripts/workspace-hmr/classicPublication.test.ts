import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, WEAPP_VITE_STATEFUL_HMR_DIRECTORY } from '@weapp-core/constants'
import { getMiniProgramPlatformDescriptor, getMiniProgramScriptModuleOptions, getSupportedMiniProgramPlatforms } from '@weapp-core/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectClassicPublication, inspectRetiredClassicTransport } from './classicPublication'

describe('classic full publication closure', () => {
  let root: string
  const write = async (name: string, source: string) => {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true })
    await writeFile(path.join(root, name), source)
  }
  const writeEntry = async (entry: string, template = '.wxml') => {
    await write(`${entry}.js`, 'Component({});')
    await write(`${entry}.json`, '{}')
    await write(`${entry}${template}`, '<view/>')
  }

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hmr-publication-'))
    await write('app.js', 'require("./shared.js"); App({});')
    await write('shared.js', 'module.exports = {};')
    await write('app.json', JSON.stringify({ pages: ['pages/index'], subPackages: [{ root: 'sub', pages: ['detail'] }], plugins: { provider: { provider: 'wx-test-plugin', version: '1.0.0' } } }))
    for (const entry of ['pages/index', 'sub/detail', 'components/card']) {
      await writeEntry(entry)
    }
    await write('pages/index.json', JSON.stringify({ usingComponents: { card: '/components/card', plugin: 'plugin://provider/card' } }))
    await write('app.wxss', '@import "./theme.wxss";')
    await write('theme.wxss', 'view { color: red; }')
    await write('pages/index.wxml', '<import src="../templates/base.wxml"/><view/>')
    await write('templates/base.wxml', '<template name="base"><view/></template>')
    await write('image.png', 'binary-asset')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('records every physical output and verifies page, component, script, style and template dependencies', async () => {
    const evidence = await inspectClassicPublication(root)
    expect(evidence.checkedFileCount).toBe(evidence.files.length)
    expect(evidence.files.map(file => file.path)).toEqual(expect.arrayContaining(['app.js', 'app.json', 'sub/detail.js', 'image.png']))
    expect(evidence.files.every(file => /^[a-f\d]{64}$/.test(file.hash))).toBe(true)
  })

  it.each(['shared.js', 'sub/detail.wxml', 'components/card.json', 'theme.wxss', 'templates/base.wxml'])('rejects a missing emitted dependency: %s', async (file) => {
    await rm(path.join(root, file))
    await expect(inspectClassicPublication(root)).rejects.toThrow(/missing/)
  })

  it.each(['import', 'include'])('resolves explicit and extensionless template references in %s', async (tag) => {
    await write('pages/index.wxml', `<${tag} src="../templates/base"/><${tag} src="../templates/base.wxml"/><view/>`)
    await expect(inspectClassicPublication(root)).resolves.toBeDefined()
    await rm(path.join(root, 'templates/base.wxml'))
    await write('templates/base', '<view/>')
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing templates/base.wxml')
  })

  it.each(['import', 'include'])('does not append another extension to a missing explicit %s reference', async (tag) => {
    await write('pages/index.wxml', `<${tag} src="../templates/base.wxml"/><view/>`)
    await rm(path.join(root, 'templates/base.wxml'))
    await write('templates/base.wxml.wxml', '<view/>')
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing templates/base.wxml')
  })

  it('examines unreferenced emitted files too, so stale stateful code cannot hide outside app imports', async () => {
    await write('orphan.js', '// weapp-vite-stateful-build:old\nvoid 0;')
    await expect(inspectClassicPublication(root)).rejects.toThrow('stateful client')
  })

  it.each(['cjs', 'mjs'])('checks dependencies in emitted .%s scripts', async (extension) => {
    await write(`orphan.${extension}`, 'module.exports = require("./missing.js");')
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing script dependency ./missing.js')
  })

  it('checks scripts inside every physical npm output, including directories that are not a weapp bare-import fallback', async () => {
    await write('node_modules/unreferenced/index.js', 'require("./missing.js");')
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing script dependency ./missing.js from node_modules/unreferenced/index.js')
    await write('node_modules/unreferenced/missing.js', 'module.exports = {};')
    await expect(inspectClassicPublication(root)).resolves.toBeDefined()
    await write('shared.js', 'require("unreferenced");')
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing script dependency unreferenced from shared.js')
  })

  it.each([
    [WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, 'WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY'],
    [WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY, 'WEAPP_VITE_STATEFUL_HMR_CONTROL_KEY'],
    [WEAPP_VITE_STATEFUL_HMR_DIRECTORY, 'WEAPP_VITE_STATEFUL_HMR_DIRECTORY'],
  ])('allows inert public %s constants while checking every emitted script for executable uses', async (key, publicName) => {
    await write('shared.js', `const alias = ${JSON.stringify(key)}; exports.${publicName} = alias;`)
    await write('orphan.js', `export const ${publicName} = ${JSON.stringify(key)};`)
    await expect(inspectClassicPublication(root)).resolves.toBeDefined()
    await write('orphan.js', `const alias = ${JSON.stringify(key)}; globalThis[alias] = {};`)
    await expect(inspectClassicPublication(root)).rejects.toThrow(`must remove ${key}`)
  })

  it.each([
    `require('./${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}/control.js');`,
    `import './${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}/control.js';`,
    `const directory = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_DIRECTORY)}; require(directory + '/control.js');`,
    `const directory = ${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_DIRECTORY)}; const entry = \`\${directory}/update.js\`; read(entry);`,
  ])('rejects executable control paths without requiring the retired file to exist: %s', async (source) => {
    await write('shared.js', source)
    await expect(inspectClassicPublication(root)).rejects.toThrow(`must remove ${WEAPP_VITE_STATEFUL_HMR_DIRECTORY}`)
  })

  it('rejects a retired control artifact and output imports escaping the publication', async () => {
    await write('__weapp_vite_hmr/control.js', 'void 0;')
    await expect(inspectClassicPublication(root)).rejects.toThrow('stateful control file')
    await rm(path.join(root, '__weapp_vite_hmr/control.js'))
    await write('shared.js', 'require("../outside.js");')
    await expect(inspectClassicPublication(root)).rejects.toThrow('escapes')
  })

  it('resolves local, scoped, nested and subpackage npm components using the emitted package graph', async () => {
    for (const entry of ['pages/local-card', 'miniprogram_npm/library/card', 'miniprogram_npm/library/icon', 'sub/miniprogram_npm/@scope/library/card', 'miniprogram_npm/library/miniprogram_npm/nested/icon']) {
      await writeEntry(entry)
    }
    await write('pages/index.json', JSON.stringify({ usingComponents: { local: 'local-card', npm: 'library/card' } }))
    await write('miniprogram_npm/library/card.json', JSON.stringify({ usingComponents: { sibling: 'library/icon', nested: 'nested/icon' } }))
    await write('sub/detail.json', JSON.stringify({ usingComponents: { scoped: '@scope/library/card' } }))
    await expect(inspectClassicPublication(root)).resolves.toMatchObject({ checkedFileCount: expect.any(Number) })
    await rm(path.join(root, 'miniprogram_npm/library/icon.wxml'))
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing')
  })

  it('only accepts extended library components when their known library is explicitly enabled', async () => {
    await write('pages/index.json', JSON.stringify({ usingComponents: { badge: 'weui-miniprogram/badge/badge' } }))
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing')
    const app = JSON.parse(await readFile(path.join(root, 'app.json'), 'utf8')) as Record<string, unknown>
    await write('app.json', JSON.stringify({ ...app, useExtendedLib: { weui: true } }))
    await expect(inspectClassicPublication(root)).resolves.toBeDefined()
    await write('app.json', JSON.stringify({ ...app, useExtendedLib: { weui: false, arbitrary: true } }))
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing')
  })

  it.each(['plugin://unknown/card', 'dynamicLib://provider/card', 'unknown://provider/card'])('rejects undeclared or unsupported external component references: %s', async (target) => {
    await write('pages/index.json', JSON.stringify({ usingComponents: { external: target } }))
    await expect(inspectClassicPublication(root)).rejects.toThrow(/undeclared|unsupported/)
  })

  it('checks emitted wxs module requires while ignoring commented template references', async () => {
    await write('pages/index.wxml', '<!-- <wxs src="./missing.wxs"/> --><wxs src="./main.wxs"/><view/>')
    await write('pages/main.wxs', 'module.exports = require("./dependency.wxs");')
    await write('pages/dependency.wxs', 'module.exports = {};')
    await expect(inspectClassicPublication(root)).resolves.toBeDefined()
    await rm(path.join(root, 'pages/dependency.wxs'))
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing script dependency')
  })

  it.each(['import("./lazy.js");', 'const value = require("./lazy.json");', 'const value = require("library");'])('checks static module resolution for %s', async (source) => {
    await write('shared.js', source)
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing script dependency')
    await write('lazy.js', 'export default {};')
    await write('lazy.json', '{}')
    await write('miniprogram_npm/library/index.js', 'module.exports = {};')
    await expect(inspectClassicPublication(root)).resolves.toBeDefined()
  })

  it('rejects dynamic module paths whose dependency closure cannot be established', async () => {
    // eslint-disable-next-line no-template-curly-in-string -- 保留待解析源码的动态模板表达式。
    await write('shared.js', 'const name = "lazy.js"; import(`./${name}`);')
    await expect(inspectClassicPublication(root)).rejects.toThrow('unsupported dynamic import')
  })

  it.each(getSupportedMiniProgramPlatforms())('verifies complete page, component, template, style and module dependencies for %s', async (platform) => {
    await rm(root, { recursive: true })
    const { wxml: template, wxss: style, wxs: module = 'wxs' } = getMiniProgramPlatformDescriptor(platform).outputExtensions
    const script = getMiniProgramScriptModuleOptions(platform, module)
    await write('app.js', 'App({});')
    await write('app.json', JSON.stringify({ pages: ['pages/index'], subPackages: [{ root: 'sub', pages: ['detail'] }] }))
    for (const entry of ['pages/index', 'sub/detail', 'components/card']) {
      await writeEntry(entry, `.${template}`)
    }
    await write('pages/index.json', JSON.stringify({ usingComponents: { card: '/components/card' } }))
    await write(`app.${style}`, `@import url("./theme.${style}");`)
    await write(`theme.${style}`, 'view { color: red; }')
    await write(`pages/index.${template}`, `<import src="../templates/base"/><${script.tag} ${script.sourceAttribute}="./main.${module}" ${script.moduleAttribute}="main"/><view/>`)
    await write(`templates/base.${template}`, '<template name="base"><view/></template>')
    await write(`pages/main.${module}`, script.format === 'esm'
      ? `import value from "./dependency.${module}"; export default value;`
      : `module.exports = require("./dependency.${module}");`)
    await write(`pages/dependency.${module}`, script.format === 'esm' ? 'export default {};' : 'module.exports = {};')
    const evidence = await inspectClassicPublication(root, platform)
    expect(evidence.checkedFileCount).toBe(evidence.files.length)
    for (const dependency of [
      'sub/detail.js',
      'sub/detail.json',
      `sub/detail.${template}`,
      'components/card.js',
      'components/card.json',
      `components/card.${template}`,
      `templates/base.${template}`,
      `theme.${style}`,
      `pages/main.${module}`,
      `pages/dependency.${module}`,
    ]) {
      const source = await readFile(path.join(root, dependency))
      await rm(path.join(root, dependency))
      await expect(inspectClassicPublication(root, platform)).rejects.toThrow(/missing/)
      await write(dependency, source.toString('utf8'))
    }
  })

  it('accepts quoted and unquoted local or external stylesheet urls but still checks local files', async () => {
    await write('app.wxss', '@import url(https://example.com/theme.css); @import URL("https://example.com/other.css"); @import url(./theme.wxss);')
    await expect(inspectClassicPublication(root)).resolves.toBeDefined()
    await rm(path.join(root, 'theme.wxss'))
    await expect(inspectClassicPublication(root)).rejects.toThrow('missing')
  })

  it('rejects unsupported stylesheet reference syntax', async () => {
    await write('app.wxss', '@import var(--theme);')
    await expect(inspectClassicPublication(root)).rejects.toThrow('unsupported stylesheet import')
  })
})

describe('retired stateful transport inspection', () => {
  const control = { buildId: 'before-build', token: 'before-token', url: 'http://127.0.0.1:3210/hmr' }
  const refused = (address = '127.0.0.1', port = 3210, code = 'ECONNREFUSED') => Object.assign(new Error('connection failed'), { code, address, port })
  const failedRequest = (cause: unknown) => vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed', { cause }))

  it('uses the captured session identity and requires an explicit retirement response', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ type: 'retired' }, { status: 410 }))
    await expect(inspectRetiredClassicTransport(control, AbortSignal.timeout(1000), request)).resolves.toBe('retired-410')
    expect(request).toHaveBeenCalledWith(control.url, expect.objectContaining({ body: expect.stringContaining('before-build'), redirect: 'error' }))
  })

  it('accepts a closed listener but preserves unrelated network failures', async () => {
    await expect(inspectRetiredClassicTransport(control, AbortSignal.timeout(1000), failedRequest(refused()))).resolves.toBe('connection-refused')
    const failure = failedRequest(refused('127.0.0.1', 3210, 'ECONNRESET'))
    await expect(inspectRetiredClassicTransport(control, AbortSignal.timeout(1000), failure)).rejects.toThrow('fetch failed')
  })

  it.each([200, 301, 302, 401, 404, 500])('rejects HTTP %s instead of treating any failed request as retirement', async (status) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status }))
    await expect(inspectRetiredClassicTransport(control, AbortSignal.timeout(1000), request)).rejects.toThrow(`HTTP ${status}`)
  })

  it.each(['', '{}', '{"type":"unrelated"}'])('rejects HTTP 410 without the official retired protocol body: %s', async (body) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 410 }))
    await expect(inspectRetiredClassicTransport(control, AbortSignal.timeout(1000), request)).rejects.toThrow()
  })

  it.each([{ code: 'ECONNREFUSED' }, refused('127.0.0.2'), refused('127.0.0.1', 3211), refused('::1')])('rejects refusals not bound to the captured address and port: %o', async (cause) => {
    await expect(inspectRetiredClassicTransport(control, AbortSignal.timeout(1000), failedRequest(cause))).rejects.toThrow('fetch failed')
  })

  it('accepts only localhost aggregate failures whose every leaf refuses the captured endpoint', async () => {
    const localhostControl = { ...control, url: 'http://localhost:3210/hmr' }
    const failure = failedRequest(new AggregateError([refused('::1'), refused(), refused('::ffff:127.0.0.1')], 'Captured endpoint refused all connections'))
    await expect(inspectRetiredClassicTransport(localhostControl, AbortSignal.timeout(1000), failure)).resolves.toBe('connection-refused')
    for (const errors of [[], [refused(), refused('::1', 3211)], [refused(), refused('127.0.0.2')], [refused(), refused('::1', 3210, 'ETIMEDOUT')]]) {
      await expect(inspectRetiredClassicTransport(localhostControl, AbortSignal.timeout(1000), failedRequest(new AggregateError(errors, 'Unverified endpoint failures')))).rejects.toThrow('fetch failed')
    }
  })

  it('preserves a redirect failure instead of accepting a different endpoint response', async () => {
    const failure = failedRequest(new Error('unexpected redirect'))
    await expect(inspectRetiredClassicTransport(control, AbortSignal.timeout(1000), failure)).rejects.toThrow('fetch failed')
  })

  it('preserves cancellation', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ type: 'retired' }, { status: 410 }))
    await expect(inspectRetiredClassicTransport(control, AbortSignal.abort(new Error('cancelled')), request)).rejects.toThrow('cancelled')
    await expect(inspectRetiredClassicTransport(control, AbortSignal.abort(new Error('deadline exceeded')), failedRequest(refused()))).rejects.toThrow('deadline exceeded')
  })
})
