import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { corpusHash } from './archive'
import { createGitHubClient } from './collect/github'
import { readFrameworkCatalog, selectFrameworkTarget } from './generate/catalog'
import { expectedSnapshotsToDocuments, extractStaticSnapshots } from './generate/expected'
import { copyControlledInput, listProjectFiles, writeProjectFile } from './generate/files'
import { freezeFrameworkInput } from './generate/input'
import { extractContainerTemplate } from './generate/output'
import { createControlledProject, generationInputKey, validateGenerationIdentity } from './generate/project'

const directories: string[] = []
const mitText = `MIT License

Copyright (c) upstream contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

async function temporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'template-generation-'))
  directories.push(directory)
  return directory
}

describe('frozen compiler generation catalog', () => {
  it('registers selected releases and the frozen preprocessing pipeline without claiming an actual build', async () => {
    const catalog = await readFrameworkCatalog()
    expect(catalog.map(release => `${release.framework}@${release.version}`)).toEqual([
      'uni-vue2@2.0.2-5030320261023001',
      'uni-vue3@3.0.0-5030420261029002',
      'mpx@2.11.2',
      'mpx@2.8.64',
      'taro@4.3.2',
      'taro@3.6.40',
      'taro@2.2.22',
      'ant-design-mini@3.4.3',
    ])
    expect(catalog.every(release => release.targets.every(target => ['candidate', 'unsupported'].includes(target.support)))).toBe(true)
    expect(() => selectFrameworkTarget(catalog, 'taro', 'latest', 'weapp')).toThrow('Unregistered framework release')
    expect(() => selectFrameworkTarget(catalog, 'taro', '4.3.2', 'fabricated-platform')).toThrow('Unregistered framework target')
  })

  it('keeps genuine target extensions and compiler options independent', async () => {
    const catalog = await readFrameworkCatalog()
    const uni = selectFrameworkTarget(catalog, 'uni-vue3', '3.0.0-5030420261029002', 'mp-weixin')
    const project = createControlledProject(uni.release, uni.target)
    expect(project.files['compile.cjs']).toContain('initEnv(process.argv[2] === \'development\' ? \'dev\' : \'build\'')
    expect(project.files['compile.cjs']).not.toContain('watch:')
    expect(project.dependencies['@dcloudio/uni-mp-weixin']).toBe(uni.release.version)
    const quickapp = selectFrameworkTarget(catalog, 'uni-vue3', uni.release.version, 'quickapp-webview')
    expect(quickapp.target.extensions).toEqual(['.qxml'])
    expect(quickapp.target.container).toBeUndefined()
    const harmony = selectFrameworkTarget(catalog, 'uni-vue3', uni.release.version, 'mp-harmony')
    expect(harmony.target.extensions).toEqual(['.hxml'])
    const jd = selectFrameworkTarget(catalog, 'mpx', '2.11.2', 'jd')
    expect(jd.target.extensions).toEqual(['.jxml'])
    expect(createControlledProject(jd.release, jd.target).command).toContain('jd')
    const oldMpx = selectFrameworkTarget(catalog, 'mpx', '2.8.64', 'wx')
    const oldProject = createControlledProject(oldMpx.release, oldMpx.target)
    // 固定编译器提交的 packages/core/package.json 为 2.8.62，包版本并不总是同步。
    expect(oldProject.dependencies).toMatchObject({ '@mpxjs/core': '2.8.62', '@mpxjs/webpack-plugin': '2.8.64', 'webpack': '5.72.0' })
    expect(oldProject.files['compile.cjs']).toContain('MpxWebpackPlugin.wxmlLoader()')
    expect(oldProject.files['compile.cjs']).toContain('MpxWebpackPlugin.wxsPreLoader()')
    const taro = selectFrameworkTarget(catalog, 'taro', '4.3.2', 'alipay')
    expect(createControlledProject(taro.release, taro.target).dependencies['@tarojs/plugin-platform-alipay']).toBe('4.3.2')
  })

  it('freezes explicit input dependencies without allowing compiler replacement or ranges', async () => {
    const selected = selectFrameworkTarget(await readFrameworkCatalog(), 'uni-vue3', '3.0.0-5030420261029002', 'mp-xhs')
    const project = createControlledProject(selected.release, selected.target, { pinia: '2.1.7', vuex: '4.1.0' })
    expect(project.dependencies).toMatchObject({ pinia: '2.1.7', vuex: '4.1.0', sass: '1.77.8' })
    expect(project.files['package.json']).toContain('"pinia":"2.1.7"')
    expect(() => createControlledProject(selected.release, selected.target, { vue: '3.5.13' })).toThrow('cannot replace')
    expect(() => createControlledProject(selected.release, selected.target, { pinia: '^2.1.7' })).toThrow('exact registry versions')
    expect(() => createControlledProject(selected.release, selected.target, { 'file:bad': '1.0.0' })).toThrow('Invalid input dependency')
  })
})

describe('controlled generation input and evidence', () => {
  it('requires immutable repository identity and changes the key when inputs change', () => {
    const identity = { repository: 'owner/project', commit: 'a'.repeat(40), licenseId: 'MIT-source' }
    expect(() => validateGenerationIdentity(identity)).not.toThrow()
    expect(() => validateGenerationIdentity({ ...identity, commit: 'main' })).toThrow('immutable commit')
    expect(() => validateGenerationIdentity({ ...identity, licenseId: 'NOASSERTION' })).toThrow('confirmed license')
    expect(generationInputKey(identity, ['a'])).not.toBe(generationInputKey(identity, ['b']))
  })

  it('copies original bytes with portable paths and complete content hashes', async () => {
    const input = await temporaryDirectory()
    const destination = await temporaryDirectory()
    await mkdir(path.join(input, 'pages'))
    const source = '<template>\r\n<view>😀 {{text}}</view>\r\n</template>'
    await writeFile(path.join(input, 'pages/index.vue'), source)
    expect(await copyControlledInput(input, destination)).toEqual([
      { file: 'pages/index.vue', sha256: corpusHash(source), bytes: Buffer.byteLength(source) },
    ])
    expect(await readFile(path.join(destination, 'src/pages/index.vue'), 'utf8')).toBe(source)
    await expect(writeProjectFile(destination, '../outside', '')).rejects.toThrow('Unsafe generated project path')
  })

  it('rejects executable upstream configuration and linked source', async () => {
    const input = await temporaryDirectory()
    await writeFile(path.join(input, 'babel.config.js'), 'throw new Error("must not execute")')
    await expect(listProjectFiles(input)).rejects.toThrow('Executable upstream tool configuration')
    await rm(path.join(input, 'babel.config.js'))
    const linkedDirectory = await temporaryDirectory()
    await symlink(linkedDirectory, path.join(input, 'linked'), 'junction')
    await expect(listProjectFiles(input)).rejects.toThrow('Symlink not allowed')
  })

  it('extracts only a genuine container template and preserves its UTF-16 range', () => {
    const source = '<template><div>😀 {{text}}</div></template><script>export default { value: "<div>" }</script><style>div { color: red }</style>'
    const result = extractContainerTemplate(source)
    expect(result.source).toBe('<div>😀 {{text}}</div>')
    expect(source.slice(result.start, result.end)).toBe(result.source)
    expect(() => extractContainerTemplate('<script>const x = "<template/>"</script>')).toThrow('no explicit template block')
    expect(() => extractContainerTemplate('<template/><template/>')).toThrow('no explicit region')
    expect(() => extractContainerTemplate('<template/>')).toThrow('no explicit region')
  })
})

describe('upstream frozen source projection', () => {
  it('retains original binary/source bytes, complete tree, license and explicit exclusions', async () => {
    const directory = await temporaryDirectory()
    const sources: Record<string, Uint8Array> = {
      'LICENSE': Buffer.from(mitText),
      'src/main.js': Buffer.from('import App from "./App.vue"\r\n'),
      'src/App.vue': Buffer.from('<template><view>真实上游</view></template>'),
      'src/static/picture.png': Uint8Array.of(137, 80, 78, 71, 0, 255),
      'src/vite.config.js': Buffer.from('throw new Error("must not execute")'),
      'docs/index.md': Buffer.from('docs'),
    }
    const tree = Object.entries(sources).map(([file, bytes]) => ({
      path: file,
      type: 'blob',
      mode: '100644',
      sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
    }))
    const client = createGitHubClient({
      cacheDir: path.join(directory, 'cache'),
      transport: {
        async json() { return { truncated: false, tree } },
        async bytes(url) {
          const file = decodeURIComponent(new URL(url).pathname.split('/').slice(4).join('/'))
          return sources[file]!
        },
      },
    })
    const options = {
      source: { repository: 'owner/project', commit: 'a'.repeat(40), license: { spdx: 'MIT', files: ['LICENSE'] } },
      prefix: 'src',
      outputDir: path.join(directory, 'frozen'),
      cacheDir: path.join(directory, 'cache'),
      client,
    }
    const result = await freezeFrameworkInput(options)
    expect(result).toMatchObject({ treeFiles: 6, selectedFiles: 3 })
    expect(await readFile(path.join(result.directory, 'src/static/picture.png'))).toEqual(Buffer.from(sources['src/static/picture.png']!))
    expect(await readFile(path.join(result.directory, 'src/main.js'))).toEqual(Buffer.from(sources['src/main.js']!))
    const metadata = JSON.parse(await readFile(path.join(result.directory, 'input-metadata.json'), 'utf8')) as { complete: boolean, projection: Array<{ path: string, reason?: string }>, licenses: Array<{ id: string }> }
    expect(metadata.complete).toBe(true)
    expect(metadata.licenses[0]!.id).toBe(result.identity.licenseId)
    expect(metadata.projection).toContainEqual(expect.objectContaining({ path: 'src/vite.config.js', reason: 'executable-upstream-tool-configuration' }))
    expect(metadata.projection).toContainEqual(expect.objectContaining({ path: 'docs/index.md', reason: 'outside-selected-source-prefix' }))
    const templateOnly = await freezeFrameworkInput({ ...options, include: ['**/*.vue'] })
    expect(templateOnly.selectedFiles).toBe(1)
    const selection = JSON.parse(await readFile(path.join(templateOnly.directory, 'input-metadata.json'), 'utf8')) as { projection: Array<{ path: string, reason?: string }> }
    expect(selection.projection).toContainEqual(expect.objectContaining({ path: 'src/main.js', reason: 'outside-selected-input-patterns' }))
    await writeFile(path.join(result.directory, 'src/main.js'), 'changed')
    await expect(freezeFrameworkInput(options)).rejects.toThrow('Previously frozen controlled source changed')
  })

  it('preserves original encoded license bytes and refuses an unconfirmed nested grant', async () => {
    const directory = await temporaryDirectory()
    const licenseBytes = Buffer.concat([Buffer.from(mitText), Buffer.from([0xD6, 0xD0])])
    const sources: Record<string, Uint8Array> = {
      'LICENSE': licenseBytes,
      'src/App.vue': Buffer.from('<template><view>original</view></template>'),
    }
    function client() {
      const tree = Object.entries(sources).map(([file, bytes]) => ({
        path: file,
        type: 'blob',
        mode: '100644',
        sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),
      }))
      return createGitHubClient({
        cacheDir: path.join(directory, 'cache'),
        transport: {
          async json() { return { truncated: false, tree } },
          async bytes(url) {
            return sources[decodeURIComponent(new URL(url).pathname.split('/').slice(4).join('/'))]!
          },
        },
      })
    }
    const options = {
      source: { repository: 'owner/project', commit: 'a'.repeat(40), license: { spdx: 'MIT', files: ['LICENSE'], encodings: { LICENSE: 'gb18030' } } },
      prefix: 'src',
      outputDir: path.join(directory, 'frozen'),
      cacheDir: path.join(directory, 'cache'),
      client: client(),
    }
    const frozen = await freezeFrameworkInput(options)
    expect(await readFile(path.join(frozen.directory, 'attribution/LICENSE'))).toEqual(licenseBytes)
    sources['src/LICENSE'] = Buffer.from('From upstream: https://example.test/original')
    const blocked = { ...options, source: { ...options.source, commit: 'b'.repeat(40) }, client: client() }
    await expect(freezeFrameworkInput(blocked)).rejects.toThrow('Controlled input license is unconfirmed for src/App.vue: nearest-license-grant-unconfirmed')
  })
})

describe('static upstream expected outputs', () => {
  it('extracts literal Jest exports and inline snapshots without executing upstream code', () => {
    const output = '<view title="x">😀\n{{value}}</view>'
    const snapshot = `"${output.replace(/["\\]/g, '\\$&')}"`
    const input = [
      'throw new Error("must not execute")',
      `exports["target template"] = ${JSON.stringify(snapshot)}`,
      `expect(result).toMatchInlineSnapshot(${JSON.stringify(snapshot)})`,
      'exports["dynamic"] = computeTemplate()',
      `exports["object"] = ${JSON.stringify('{"code":"<view/>"}')}`,
    ].join('\n')
    const extraction = extractStaticSnapshots(input)
    expect(extraction.snapshots.map(item => item.source)).toEqual([output, output])
    expect(extraction.rejected.map(item => item.key)).toEqual(['dynamic', 'object'])
    const documents = expectedSnapshotsToDocuments(extraction, { repository: 'owner/project', commit: 'b'.repeat(40), licenseId: 'confirmed' }, 'test/template.snap', 'jd-xml')
    expect(documents[0]!.origins[0]).toMatchObject({ category: 'expected', platform: 'jd', path: 'test/template.snap' })
    expect(() => expectedSnapshotsToDocuments(extraction, { repository: 'owner/project', commit: 'b'.repeat(40), licenseId: 'confirmed' }, '../escape.snap', 'jd-xml')).toThrow('Nonportable')
  })

  it('preserves literal whitespace and refuses interpolated snapshot expressions', () => {
    const expression = '${' + 'runCode()}'
    const input = `exports["static"] = "  <view/>\\r\\n"; exports["dynamic"] = \`<view>${expression}</view>\``
    const result = extractStaticSnapshots(input, 'literal')
    expect(result.snapshots[0]!.source).toBe('  <view/>\r\n')
    expect(result.rejected[0]!.reason).toBe('Snapshot contains a dynamic expression')
  })
})
