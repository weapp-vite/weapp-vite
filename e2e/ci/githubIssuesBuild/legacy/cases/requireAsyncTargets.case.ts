import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { expect, it } from 'vitest'
import { runBuild } from '../builders/standard'
import { DIST_ROOT } from '../constants'
import { scanFiles } from '../helpers'

export const group = 'standard'
export const order = 86

export function registerGithubIssuesBuildCase() {
  it('emits callback, Promise, and native import targets inside their subpackage', async () => {
    await runBuild()

    const appJson = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as {
      subPackages?: Array<{ pages?: string[], root?: string }>
    }
    const pageJs = await fs.readFile(path.join(DIST_ROOT, 'pages/require-async/index.js'), 'utf-8')
    const callbackJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/require-async/callback.js'), 'utf-8')
    const promiseJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/require-async/promise.js'), 'utf-8')
    const nativeJs = await fs.readFile(path.join(DIST_ROOT, 'subpackages/require-async/import-native.js'), 'utf-8')
    const outputFiles = await scanFiles(DIST_ROOT)
    const jsFiles = outputFiles.filter(file => file.endsWith('.js'))
    const outputCode = new Map(await Promise.all(jsFiles.map(async file => [
      file,
      await fs.readFile(path.join(DIST_ROOT, file), 'utf-8'),
    ] as const)))

    expect(appJson.subPackages).toContainEqual(expect.objectContaining({
      pages: ['index'],
      root: 'subpackages/require-async',
    }))
    expect(pageJs).toMatch(/require\.async\((['"])\.\.\/\.\.\/subpackages\/require-async\/callback\.js\1\)\.then\(/)
    expect(pageJs).toMatch(/require\.async\((['"])\.\.\/\.\.\/subpackages\/require-async\/promise\.js\1\)/)
    expect(pageJs).toMatch(/require\.async\((['"])\.\.\/\.\.\/subpackages\/require-async\/import-native\.js\1\)/)
    expect(pageJs).not.toMatch(/import\((['"])\.\.\/\.\.\/subpackages\/require-async\/import-native/)
    expect(callbackJs).toContain('require-async:callback')
    expect(promiseJs).toContain('require-async:promise')
    expect(nativeJs).toContain('require-async:native-default')
    expect(nativeJs).toContain('require-async:native-named')

    for (const marker of [
      'require-async:native-default',
      'require-async:native-named',
      'require-async:transitive',
    ]) {
      const markerFiles = [...outputCode]
        .filter(([, code]) => code.includes(marker))
        .map(([file]) => file)
      expect(markerFiles.length).toBeGreaterThan(0)
      expect(markerFiles.every(file => file.startsWith('subpackages/require-async/'))).toBe(true)
    }

    expect(await fs.pathExists(path.join(DIST_ROOT, 'callback.js'))).toBe(false)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'import-native.js'))).toBe(false)
    expect(await fs.pathExists(path.join(DIST_ROOT, 'transitive.js'))).toBe(false)
  })
}
