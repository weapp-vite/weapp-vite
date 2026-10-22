import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { finished } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

it('naturally exits after real Less/Sass sidecar preprocessing across generations and multiple outputs', async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'weapp-native-style-pools-')))
  const cssUrl = new URL('../../css.ts', import.meta.url).href
  const stateUrl = new URL('../../../runtime/runtimeState.ts', import.meta.url).href
  const dependencies = fileURLToPath(new URL('../../../../../../node_modules', import.meta.url))
  let child: ReturnType<typeof spawn> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await symlink(dependencies, path.join(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
    const script = path.join(root, 'style-generations.mts')
    await writeFile(script, `
      import assert from 'node:assert/strict'
      import { mkdir, writeFile } from 'node:fs/promises'
      import path from 'node:path'
      import { build } from ${JSON.stringify(import.meta.resolve('vite'))}
      import { css } from ${JSON.stringify(cssUrl)}
      import { createRuntimeState } from ${JSON.stringify(stateUrl)}
      const root = ${JSON.stringify(root)}
      const src = path.join(root, 'src')
      const entry = path.join(src, 'app.js')
      const less = path.join(src, 'page.less')
      const theme = path.join(src, 'theme.less')
      const sass = path.join(src, 'shared.scss')
      const compiled = path.join(src, 'compiled.scss')
      const tokens = path.join(src, '_tokens.scss')
      const palette = path.join(src, 'nested/_palette.scss')
      const publicDir = path.join(root, 'public')
      await mkdir(path.join(src, 'nested'), { recursive: true })
      await mkdir(path.join(publicDir, 'images'), { recursive: true })
      await writeFile(entry, 'import "./page.less"; import "./compiled.scss"; export const ready = true')
      await writeFile(tokens, '@forward "./nested/palette";')
      await writeFile(compiled, '.compiled { color: $brand; background-image: url("/images/public.svg?theme=dark#icon"), url("./mixed.svg"), url("./large.svg"), url("/images/public-second.svg"); }')
      const image = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path fill="red" d="M0 0h1v1H0z"/></svg>'
      await writeFile(path.join(src, 'regular.svg'), image)
      await writeFile(path.join(src, 'mixed.svg'), image.replace('red', 'blue'))
      await writeFile(path.join(src, 'imported.svg'), image.replace('red', 'orange'))
      await writeFile(path.join(src, 'large.svg'), image.replace('</svg>', '<!--' + 'large image'.repeat(1000) + '--></svg>'))
      await writeFile(path.join(publicDir, 'images/public.svg'), image.replace('red', 'green'))
      await writeFile(path.join(publicDir, 'images/public-second.svg'), image.replace('red', 'purple'))
      await writeFile(path.join(src, 'nested/images.less'), '.imported { background-image: url("/images/public-second.svg?from=import#icon"), url("../imported.svg"); }')
      const ctx = {
        runtimeState: createRuntimeState(),
        scanService: { subPackageMap: new Map(), mainPackageStyleEntries: [{ source: 'shared.scss', absolutePath: sass, outputRelativePath: 'shared.wxss', inputExtension: '.scss', scope: 'all', include: ['**/*'], exclude: [] }] },
        configService: {
          cwd: root, absoluteSrcRoot: src, isDev: false, platform: 'weapp', outputExtensions: { wxss: 'wxss' },
          relativeOutputPath: file => path.relative(src, file).replaceAll('\\\\', '/'),
          relativeAbsoluteSrcRoot: file => path.relative(src, file).replaceAll('\\\\', '/'),
        },
      }
      ctx.runtimeState.css.sidecarImports.add(less.replaceAll('\\\\', '/'))
      ctx.runtimeState.css.sidecarImports.add(compiled.replaceAll('\\\\', '/'))
      const plugins = [{
        name: 'fixture:style-source', enforce: 'pre',
        transform(code, id) {
          return id === compiled.replaceAll('\\\\', '/') ? code + '\\n.from-source-plugin { color: teal; }' : null
        },
      }, ...css(ctx)]
      await writeFile(less, '@import "./theme.less"; @import "./nested/images.less"; .native { color: @brand; background: url("./regular.svg"); }')
      for (const color of ['red', 'blue', 'red']) {
        await writeFile(theme, '@brand: ' + color + ';')
        await writeFile(palette, '$brand: ' + color + ';')
        await writeFile(sass, '$sharedBrand: ' + color + '; .shared { color: $sharedBrand; }')
        const result = await build({ root, configFile: false, publicDir, logLevel: 'silent', plugins,
          css: { preprocessorOptions: { scss: { additionalData: '@use "./tokens" as *;\\n' } } },
          build: { write: false, assetsInlineLimit: 0, minify: false, cssMinify: false, rolldownOptions: { input: entry, output: [{ format: 'es' }, { format: 'cjs' }] } },
        })
        const normalize = file => file.replaceAll('\\\\', '/')
        const scssDependencies = ctx.runtimeState.css.importerToDependencies.get(normalize(compiled))
        const lessDependencies = ctx.runtimeState.css.importerToDependencies.get(normalize(less))
        assert.ok(scssDependencies?.has(normalize(tokens)), 'Sass additionalData dependency lost')
        assert.ok(scssDependencies?.has(normalize(palette)), 'nested Sass dependency lost')
        assert.ok(!scssDependencies?.has(normalize(theme)), 'unrelated Less watch dependency leaked to Sass')
        assert.ok(lessDependencies?.has(normalize(theme)), 'Less theme dependency lost')
        assert.ok(!lessDependencies?.has(normalize(tokens)), 'unrelated Sass watch dependency leaked to Less')
        const outputs = Array.isArray(result) ? result : [result]
        assert.equal(outputs.length, 2)
        for (const output of outputs) {
          const styles = new Map()
          for (const file of ['page.wxss', 'shared.wxss', 'compiled.wxss']) {
            const asset = output.output.find(asset => asset.type === 'asset' && asset.fileName === file)
            assert.ok(asset, 'missing ' + file)
            assert.match(String(asset.source), new RegExp('color\\\\s*:\\\\s*' + color + '\\\\b'), file + ' did not update to ' + color)
            assert.ok(!String(asset.source).includes('__VITE_'), file + ' leaked a Vite placeholder')
            styles.set(file, String(asset.source))
          }
          assert.match(styles.get('compiled.wxss'), /from-source-plugin/)
          assert.match(styles.get('compiled.wxss'), /url\\(["']?\\/images\\/public\\.svg\\?theme=dark#icon["']?\\)/)
          assert.match(styles.get('compiled.wxss'), /url\\(["']?\\/images\\/public-second\\.svg["']?\\)/)
          assert.match(styles.get('page.wxss'), /url\\(["']?\\/images\\/public-second\\.svg\\?from=import#icon["']?\\)/)
          for (const [name, file] of [['mixed.svg', 'compiled.wxss'], ['large.svg', 'compiled.wxss'], ['regular.svg', 'page.wxss'], ['imported.svg', 'page.wxss']]) {
            const asset = output.output.find(asset => asset.type === 'asset' && asset.names.includes(name))
            assert.ok(asset, name + ' ordinary asset was not emitted natively')
            assert.ok(styles.get(file).includes('./' + asset.fileName), name + ' ordinary URL did not resolve to its native output')
          }
        }
      }
      const defaultInlineResult = await build({ root, configFile: false, publicDir, logLevel: 'silent', plugins,
        css: { preprocessorOptions: { scss: { additionalData: '@use "./tokens" as *;\\n' } } },
        build: { write: false, minify: false, cssMinify: false, rolldownOptions: { input: entry, output: [{ format: 'es' }, { format: 'cjs' }] } },
      })
      const inlineOutputs = Array.isArray(defaultInlineResult) ? defaultInlineResult : [defaultInlineResult]
      assert.equal(inlineOutputs.length, 2)
      for (const output of inlineOutputs) {
        const compiledStyle = output.output.find(asset => asset.type === 'asset' && asset.fileName === 'compiled.wxss')
        const pageStyle = output.output.find(asset => asset.type === 'asset' && asset.fileName === 'page.wxss')
        assert.ok(compiledStyle, 'default inline build lost compiled.wxss')
        assert.ok(pageStyle, 'default inline build lost page.wxss')
        const mixedSource = String(compiledStyle.source)
        assert.match(mixedSource, /from-source-plugin/)
        assert.match(mixedSource, /url\\(["']?\\/images\\/public\\.svg\\?theme=dark#icon["']?\\)/)
        assert.match(mixedSource, /url\\(["']?\\/images\\/public-second\\.svg["']?\\)/)
        assert.match(String(pageStyle.source), /url\\(["']?\\/images\\/public-second\\.svg\\?from=import#icon["']?\\)/)
        for (const [name, source] of [['mixed.svg', mixedSource], ['large.svg', mixedSource], ['regular.svg', String(pageStyle.source)], ['imported.svg', String(pageStyle.source)]]) {
          assert.ok(!source.includes('__VITE_'), name + ' default inline build leaked a Vite placeholder')
          assert.doesNotMatch(source, /url\\(\\s*["']?(?:\\.\\.\\/|\\.\\/)?(?:mixed|large|regular|imported)\\.svg["']?\\s*\\)/, name + ' default inline build retained a source-relative URL')
          const asset = output.output.find(asset => asset.type === 'asset' && asset.names.includes(name))
          if (name === 'large.svg') {
            assert.ok(asset, 'default inline build did not emit the large ordinary asset')
          }
          if (asset) {
            assert.ok(source.includes('./' + asset.fileName), name + ' default inline build lost its native emitted URL')
          }
          else {
            assert.match(source, /data:image\\/svg\\+xml[;,]/i, name + ' default inline build lost its native data URL')
          }
        }
      }
      process.stdout.write('STYLE_GENERATIONS_COMPLETE\\n')
    `)
    child = spawn(process.execPath, ['--import', 'tsx', script], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout!.on('data', chunk => stdout += String(chunk))
    child.stderr!.on('data', chunk => stderr += String(chunk))
    const exited = once(child, 'exit')
    timeout = setTimeout(() => child!.kill('SIGKILL'), 20_000)
    const [[code, signal]] = await Promise.all([exited, finished(child.stdout!), finished(child.stderr!)])
    expect(signal, `${stdout}\n${stderr}`).toBeNull()
    expect(code, `${stdout}\n${stderr}`).toBe(0)
    expect(stdout).toContain('STYLE_GENERATIONS_COMPLETE\n')
  }
  finally {
    clearTimeout(timeout)
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit')
      child.kill('SIGKILL')
      await exited
    }
    await rm(root, { recursive: true, force: true })
  }
}, 25_000)
