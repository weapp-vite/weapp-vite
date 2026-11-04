import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { reserveProfileOutput } from './output'

const directories: string[] = []
afterEach(async () => {
  await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

it('reserves a unique directory and refuses to overwrite existing samples or an empty run', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'corpus-profile-output-'))
  directories.push(directory)
  const output = path.join(directory, 'nested', 'run-1')
  await reserveProfileOutput(output)
  await expect(reserveProfileOutput(output)).rejects.toThrow('requires a new output directory')
  const samples = '{"samples":[{"round":0,"arm":"candidate"}]}\n'
  await writeFile(path.join(output, 'report.json'), samples)
  await expect(reserveProfileOutput(output)).rejects.toThrow('preserve previous evidence')
  expect(await readFile(path.join(output, 'report.json'), 'utf8')).toBe(samples)
  await writeFile(path.join(directory, 'occupied'), 'existing file')
  await expect(reserveProfileOutput(path.join(directory, 'occupied'))).rejects.toThrow('requires a new output directory')
})
