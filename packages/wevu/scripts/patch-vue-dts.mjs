import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.resolve(scriptDir, '..', 'dist')
const targets = [
  path.join(distDir, 'index.d.mts'),
  path.join(distDir, 'compiler.d.mts'),
  path.join(distDir, 'jsx-runtime.d.mts'),
]

const replacements = [
  ['@vue/reactivity', './vue-types'],
  ['@vue/runtime-core', './vue-types'],
  ['"vue"', '"./vue-types"'],
  ['\'vue\'', '\'./vue-types\''],
]

async function patchFile(filePath) {
  try {
    await access(filePath)
  }
  catch {
    return
  }

  const original = await readFile(filePath, 'utf8')
  let next = original
  for (const [from, to] of replacements) {
    next = next.replaceAll(from, to)
  }

  if (next !== original) {
    await writeFile(filePath, next)
  }
}

await Promise.all(targets.map(patchFile))
