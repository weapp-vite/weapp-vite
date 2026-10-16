import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { compileTailwindV4Source, loadTailwindV4DesignSystem, loadTailwindV4NodeModule } from '@weapp-tailwindcss/engine'
import { createCompiler } from 'weapp-tailwindcss/core'
import { resolveTailwindV4Source } from 'weapp-tailwindcss/generator'

const require = createRequire(import.meta.url)
async function run() {
  const observations = []

  for (const kind of ['config', 'plugin']) {
    for (const identity of ['physical', 'junction']) {
      for (const phase of ['initial', 'introduced']) {
        for (const spelling of ['native', 'posix']) {
          const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-module-dependencies-')))
          const observation = { kind, identity, phase, spelling, node: process.version }
          let operation = 'setup'
          let resolvedSource
          const shape = value => ({
            type: typeof value,
            keys: value && Object.keys(value),
            defaultType: typeof value?.default,
            defaultKeys: value?.default && Object.keys(value.default),
            nestedDefaultType: typeof value?.default?.default,
          })
          const compiler = createCompiler({ appType: 'weapp-vite', tailwindcssBasedir: root, cssPreflight: false })
          try {
            await mkdir(path.join(root, 'src'))
            await mkdir(path.join(root, 'node_modules'))
            await symlink(path.dirname(require.resolve('tailwindcss/package.json')), path.join(root, 'node_modules/tailwindcss'), 'junction')
            if (identity === 'junction') {
              await symlink(path.join(root, 'src'), path.join(root, 'module-alias'), 'junction')
            }
            const entry = path.join(root, 'src/app.css')
            const dependency = path.join(root, identity === 'junction' ? 'module-alias' : 'src', `${kind}.ts`)
            const moduleSource = width => kind === 'config'
              ? `export default { theme: { extend: { spacing: { probe: '${width}px' } } } }; export const utility = 'w-[${width}px]'`
              : `export default ({ addUtilities }) => addUtilities({ '.plugin-probe': { width: '${width}px' } }); export const utility = 'w-[${width}px]'`
            await writeFile(path.join(root, 'src/page.ts'), `export const utility = '${kind === 'config' ? 'w-probe' : 'plugin-probe'}'`)
            const css = '@import "tailwindcss" source(none); @source "./*.ts";'
            const format = file => spelling === 'posix' ? file.replaceAll('\\', '/') : file
            const request = { id: 'root', sourceOptions: { projectRoot: format(root), cssEntries: [format(entry)] }, scanSources: true, target: 'weapp', incrementalCache: false }
            if (phase === 'introduced') {
              await writeFile(entry, css)
              operation = 'baseline'
              const baseline = await compiler.generate(request)
              observation.entryId = baseline.dependencies.find(file => path.resolve(file) === path.resolve(entry))
            }
            await writeFile(entry, `${css} @${kind} "${identity === 'junction' ? '../module-alias' : '.'}/${kind}.ts";`)
            await writeFile(dependency, moduleSource(137))
            if (phase === 'introduced') {
              observation.entryInvalidation = compiler.invalidate([observation.entryId ?? format(entry)]).includes(request.id)
            }
            delete observation.entryId
            operation = 'resolve-source'
            const resolved = await resolveTailwindV4Source(request.sourceOptions)
            resolvedSource = resolved
            observation.sourceHasModule = resolved.css.includes(`@${kind}`)
            observation.sourceBase = path.relative(root, resolved.base).replaceAll('\\', '/')
            operation = 'initial'
            const initial = await compiler.generate(request)
            observation.initialWidth = /width:\s*137px/.test(initial.css)
            observation.initialCache = initial.cache
            observation.dependencies = await Promise.all(initial.dependencies.map(async (file) => {
              const relative = path.relative(root, await realpath(file)).replaceAll('\\', '/')
              return relative.startsWith('../') || path.isAbsolute(relative) ? '<external>' : relative
            }))
            await writeFile(dependency, moduleSource(149))
            observation.moduleInvalidation = compiler.invalidate([format(await realpath(dependency))]).includes(request.id)
            operation = 'refreshed'
            const refreshed = await compiler.generate(request)
            Object.assign(observation, {
              refreshedWidth: /width:\s*149px/.test(refreshed.css),
              staleWidth: /width:\s*137px/.test(refreshed.css),
              refreshedCandidate: refreshed.classSet.has('w-[149px]'),
              staleCandidate: refreshed.classSet.has('w-[137px]'),
            })
          }
          catch (error) {
            const message = String(error?.stack ?? error).replaceAll('\\', '/')
            observation.error = message
              .replaceAll(root.replaceAll('\\', '/'), '<fixture>')
              .replaceAll(process.cwd().replaceAll('\\', '/'), '<repository>')
              .replaceAll(os.tmpdir().replaceAll('\\', '/'), '<temporary>')
            observation.operation = operation
            if (resolvedSource && operation === 'refreshed') {
              const source = { ...resolvedSource, baseFallbacks: [] }
              observation.sourceCss = source.css
                .replaceAll(root.replaceAll('\\', '/'), '<fixture>')
                .replaceAll(root, '<fixture>')
              for (const [stage, generate] of [['compile', compileTailwindV4Source], ['design', loadTailwindV4DesignSystem]]) {
                try {
                  await generate(source, { cache: false })
                  observation[`${stage}Primary`] = 'success'
                }
                catch (cause) {
                  observation[`${stage}Primary`] = String(cause?.stack ?? cause)
                    .replaceAll('\\', '/')
                    .replaceAll(root.replaceAll('\\', '/'), '<fixture>')
                    .replaceAll(process.cwd().replaceAll('\\', '/'), '<repository>')
                    .replaceAll(os.tmpdir().replaceAll('\\', '/'), '<temporary>')
                }
              }
              observation.requireCache = Object.values(require.cache)
                .filter(entry => entry?.filename?.startsWith(root))
                .map(entry => ({ file: path.relative(root, entry.filename).replaceAll('\\', '/'), loaded: entry.loaded, exports: shape(entry.exports) }))
              const loader = await loadTailwindV4NodeModule([source.projectRoot, source.base])
              for (const [name, load] of [
                ['relativeLoader', () => loader.loadModule(`./${kind}.ts`, source.base, () => {})],
                ['nativeImport', () => import(`${pathToFileURL(path.join(root, 'src', `${kind}.ts`)).href}?diagnostic=${Date.now()}`)],
              ]) {
                try {
                  const value = await load()
                  observation[name] = shape(name === 'relativeLoader' ? value.module : value)
                }
                catch (cause) {
                  observation[name] = String(cause).replaceAll(root, '<fixture>')
                }
              }
            }
          }
          finally {
            await compiler.dispose()
            await rm(root, { recursive: true, force: true })
            observations.push(observation)
          }
        }
      }
    }
  }
  process.stdout.write(`\n${JSON.stringify(observations)}`)
}

run().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`)
  process.exitCode = 1
})
