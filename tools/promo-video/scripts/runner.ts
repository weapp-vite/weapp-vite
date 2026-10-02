import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { entryPoint, films, projectDir, publicDir } from './paths'
import { prepareAssets } from './prepare'
import { runProcess } from './process'
import { renderFilms } from './render'
import { verifyFilms } from './verify'

async function main() {
  const command = process.argv[2]
  switch (command) {
    case 'studio': {
      await prepareAssets()
      const require = createRequire(import.meta.url)
      const cli = path.join(path.dirname(require.resolve('@remotion/cli/package.json')), 'remotion-cli.js')
      await runProcess(process.execPath, [cli, 'studio', entryPoint, '--public-dir', publicDir], true, projectDir)
      break
    }
    case 'render':
      await renderFilms(films, false)
      break
    case 'render:landscape':
      await renderFilms([films[0]], false)
      break
    case 'render:portrait':
      await renderFilms([films[1]], false)
      break
    case 'render:stills':
      await renderFilms(films, true)
      break
    case 'verify':
      await verifyFilms()
      break
    default:
      throw new Error('Expected studio, render, render:landscape, render:portrait, render:stills or verify')
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
