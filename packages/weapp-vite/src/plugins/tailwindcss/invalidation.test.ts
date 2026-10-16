import path from 'node:path'
import { expect, it } from 'vitest'
import { resolveTailwindInvalidationIds } from './invalidation'

const sourceId = (file: string) => file.replaceAll('\\', '/')

it('passes the exact Windows dependency ID back to core for a normalized watcher path', () => {
  const entry = 'C:\\fixture\\src\\app.css'
  const snapshots = [{ dependencies: [entry, 'C:\\fixture\\src\\config.ts'] }]
  expect(resolveTailwindInvalidationIds('C:/fixture/src/app.css', snapshots, sourceId)).toEqual([entry])
})

it('keeps every matching original ID across roots without invalidating unrelated dependencies', () => {
  const entry = 'C:\\fixture\\src\\config.ts'
  const snapshots = [
    { dependencies: [entry, 'C:\\fixture\\src\\app.css'] },
    { dependencies: ['C:/fixture/src/config.ts', entry, 'C:/other/config.ts'] },
  ]
  expect(resolveTailwindInvalidationIds('C:/fixture/src/config.ts', snapshots, sourceId)).toEqual([entry, 'C:/fixture/src/config.ts'])
})

it('preserves unknown and newly created paths for core source matching', () => {
  expect(resolveTailwindInvalidationIds('src/new.ts', [{ dependencies: ['src/app.css'] }], sourceId)).toEqual([path.normalize('src/new.ts')])
})
