import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { compileTailwindV4Source, loadTailwindV4DesignSystem } from '@weapp-tailwindcss/engine'
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
          const observation = { kind, identity, phase, spelling }
          let operation = 'setup'
          let resolvedSource
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
            const request = { id: 'root', sourceOptions: { projectRoot: format(root), cssEntries: [format(entry)] }, scanSources: true, target: 'weapp' }
            if (phase === 'introduced') {
              await writeFile(entry, css)
              operation = 'baseline'
              await compiler.generate(request)
            }
            await writeFile(entry, `${css} @${kind} "${identity === 'junction' ? '../module-alias' : '.'}/${kind}.ts";`)
            await writeFile(dependency, moduleSource(137))
            if (phase === 'introduced') {
              observation.entryInvalidation = compiler.invalidate([format(entry)]).includes(request.id)
            }
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
