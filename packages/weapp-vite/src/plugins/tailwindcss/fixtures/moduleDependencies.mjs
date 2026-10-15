import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createCompiler } from 'weapp-tailwindcss/core'

const require = createRequire(import.meta.url)
async function run() {
  const observations = []

  for (const kind of ['config', 'plugin']) {
    for (const identity of ['physical', 'junction']) {
      const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tailwind-module-dependencies-')))
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
          ? `export default { theme: { extend: { spacing: { probe: '${width}px' } } } }`
          : `export default ({ addUtilities }) => addUtilities({ '.plugin-probe': { width: '${width}px' } })`
        await writeFile(path.join(root, 'src/page.html'), `<view class="${kind === 'config' ? 'w-probe' : 'plugin-probe'}"/>`)
        await writeFile(entry, `@import "tailwindcss" source(none); @source "./*.html"; @${kind} "${identity === 'junction' ? '../module-alias' : '.'}/${kind}.ts";`)
        await writeFile(dependency, moduleSource(137))
        const request = { id: 'root', sourceOptions: { projectRoot: root, cssEntries: [entry] }, scanSources: true, target: 'weapp' }
        const initial = await compiler.generate(request)
        await writeFile(dependency, moduleSource(149))
        compiler.invalidate([await realpath(dependency)])
        const refreshed = await compiler.generate(request)
        observations.push({
          kind,
          identity,
          dependencies: await Promise.all(initial.dependencies.map(async (file) => {
            const relative = path.relative(root, await realpath(file)).replaceAll('\\', '/')
            return relative.startsWith('../') || path.isAbsolute(relative) ? '<external>' : relative
          })),
          initialWidth: /width:\s*137px/.test(initial.css),
          refreshedWidth: /width:\s*149px/.test(refreshed.css),
          staleWidth: /width:\s*137px/.test(refreshed.css),
        })
      }
      finally {
        await compiler.dispose()
        await rm(root, { recursive: true, force: true })
      }
    }
  }
  process.stdout.write(`\n${JSON.stringify(observations)}`)
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
