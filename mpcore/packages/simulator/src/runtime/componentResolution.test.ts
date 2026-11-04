import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { createFileSystemArtifactSource } from '../kernel'
import { resolveMiniProgramComponent } from './componentResolution'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

function fixture(names: string[]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-component-resolution-'))
  directories.push(root)
  for (const name of names) {
    const file = path.join(root, name)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '')
  }
  const source = createFileSystemArtifactSource()
  return (request: string) => resolveMiniProgramComponent('pages/index/index.js', request, root, source.has)
}

it.each(['/components/card', '../../components/card'])('resolves the local component directory %s to its index', (request) => {
  const resolve = fixture(['components/card/index.js', 'components/card/index.json', 'components/card/index.wxml'])
  expect(resolve(request)).toBe('components/card/index')
})

it.each(['js', 'json', 'wxml', 'wxss'])('keeps an explicit stem with only its %s artifact instead of completing it from a directory', (extension) => {
  const resolve = fixture([`components/card.${extension}`, 'components/card/index.js', 'components/card/index.json', 'components/card/index.wxml'])
  expect(resolve('/components/card')).toBe('components/card')
  expect(resolve('../../components/card')).toBe('components/card')
})

it('retains the unresolved local stem when neither entry exists', () => {
  expect(fixture([])('/components/missing')).toBe('components/missing')
})
