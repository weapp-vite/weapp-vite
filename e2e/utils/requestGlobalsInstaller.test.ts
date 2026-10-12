import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { REQUEST_GLOBAL_BUNDLE_MARKER } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { requestGlobalsAppModuleExpression, resolveRelativeModuleReferences, resolveRequestGlobalsInstaller } from './requestGlobalsInstaller'

const definition = 'function installWebRuntimeGlobals() { return globalThis }'
const cjs = `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */\n${definition}\nObject.defineProperty(exports, "installWebRuntimeGlobals", { get: function() { return installWebRuntimeGlobals } })`
const esm = `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */\n${definition}\nexport { installWebRuntimeGlobals }`
let temporary: string
let dist: string

beforeEach(async () => {
  temporary = await realpath(await mkdtemp(path.join(os.tmpdir(), 'request-installer-test-')))
  dist = path.join(temporary, 'dist')
  await mkdir(path.join(dist, 'weapp-vendors'), { recursive: true })
})

afterEach(async () => {
  await rm(temporary, { recursive: true, force: true })
})

describe('request globals installer artifact identity', () => {
  it.each([['cjs', cjs], ['esm', esm]])('finds the unique %s installer with an arbitrary name and real module references', async (format, code) => {
    const installerPath = path.join(dist, 'weapp-vendors/renamed-output.js')
    await writeFile(installerPath, code)
    await writeFile(path.join(dist, 'weapp-vendors/passive.js'), '/* __wvRGL__ */ Object.defineProperty(exports, "URL", { value: URL })')
    // 独立分包具有自己的运行时，不参与主包唯一性判断。
    await mkdir(path.join(dist, 'subpackages/independent'), { recursive: true })
    await writeFile(path.join(dist, 'subpackages/independent/installer.js'), cjs)
    const appCode = format === 'cjs'
      ? 'require("./weapp-vendors/renamed-output.js")'
      : 'import { installWebRuntimeGlobals } from "./weapp-vendors/renamed-output.js"'
    const preludeCode = 'require("./weapp-vendors/renamed-output.js")'
    const appPath = path.join(dist, 'app.js')
    const preludePath = path.join(dist, 'app.prelude.js')
    await writeFile(appPath, appCode)
    await writeFile(preludePath, preludeCode)
    expect(await resolveRequestGlobalsInstaller(dist)).toEqual({ path: installerPath, code })
    expect(await resolveRelativeModuleReferences(dist, appPath, appCode)).toEqual([installerPath])
    expect(await resolveRelativeModuleReferences(dist, preludePath, preludeCode)).toEqual([installerPath])
    expect(requestGlobalsAppModuleExpression(dist, installerPath)).toBe('globalThis["__weappViteRequestGlobalsModule:weapp-vendors/renamed-output.js"]')
  })

  it.each([
    ['missing', ''],
    ['passive bindings', '/* __wvRGL__ */ Object.defineProperty(exports, "URL", { value: URL })'],
    ['comment-only export', `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */\n${definition}\n// export { installWebRuntimeGlobals }`],
    ['string-only export', `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */\n${definition}\nconst text = "export { installWebRuntimeGlobals }"`],
    ['non-function export', `/* ${REQUEST_GLOBAL_BUNDLE_MARKER} */\nconst installWebRuntimeGlobals = 1; export { installWebRuntimeGlobals }`],
    ['missing bundle marker', `${definition}\nexport { installWebRuntimeGlobals }`],
  ])('rejects %s instead of accepting a first matching filename', async (_, code) => {
    await writeFile(path.join(dist, 'weapp-vendors/request-globals-runtime.js'), code)
    await expect(resolveRequestGlobalsInstaller(dist)).rejects.toThrow('found 0')
  })

  it('rejects two independently exported installers in the main package', async () => {
    await writeFile(path.join(dist, 'first.js'), cjs)
    await writeFile(path.join(dist, 'weapp-vendors/second.js'), esm)
    await expect(resolveRequestGlobalsInstaller(dist)).rejects.toThrow('found 2')
  })

  it('ignores fake references in comments and strings', async () => {
    const importer = path.join(dist, 'app.js')
    const code = '// require("../outside.js")\nconst text = \'require("../outside.js")\''
    await writeFile(importer, code)
    expect(await resolveRelativeModuleReferences(dist, importer, code)).toEqual([])
  })

  it('rejects a relative reference outside fixture dist', async () => {
    const importer = path.join(dist, 'app.js')
    await writeFile(importer, 'require("../outside.js")')
    await writeFile(path.join(temporary, 'outside.js'), cjs)
    await expect(resolveRelativeModuleReferences(dist, importer, 'require("../outside.js")')).rejects.toThrow('escapes fixture dist')
  })

  it('rejects an installer directory symlink outside fixture dist', async () => {
    const outside = path.join(temporary, 'outside')
    await mkdir(outside)
    await writeFile(path.join(outside, 'installer.js'), cjs)
    await rm(path.join(dist, 'weapp-vendors'), { recursive: true })
    await symlink(outside, path.join(dist, 'weapp-vendors'), 'junction')
    await expect(resolveRequestGlobalsInstaller(dist)).rejects.toThrow('escapes fixture dist')
  })

  it('rejects a relative reference that escapes through a directory symlink', async () => {
    const outside = path.join(temporary, 'outside')
    await mkdir(outside)
    await writeFile(path.join(outside, 'installer.js'), cjs)
    await symlink(outside, path.join(dist, 'linked'), 'junction')
    const importer = path.join(dist, 'app.js')
    const code = 'require("./linked/installer.js")'
    await writeFile(importer, code)
    await expect(resolveRelativeModuleReferences(dist, importer, code)).rejects.toThrow('escapes fixture dist')
  })
})
