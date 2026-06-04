import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { writeBenchmarkResolverFile } from '../scripts/utils/benchmark-tsconfig'

describe('benchmark tsconfig helpers', () => {
  it('registers generated resolver in temp fixture tsconfig files', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'weapp-vite-benchmark-tsconfig-'))

    try {
      await writeFile(path.join(projectRoot, 'tsconfig.json'), `${JSON.stringify({ include: ['src/**/*.ts'] }, null, 2)}\n`, 'utf8')
      await writeFile(path.join(projectRoot, 'tsconfig.node.json'), `${JSON.stringify({ include: ['vite.config.ts'] }, null, 2)}\n`, 'utf8')

      await writeBenchmarkResolverFile(projectRoot, 'export function VantResolver() {}\n')

      expect(existsSync(path.join(projectRoot, 'benchmark-vant-resolver.ts'))).toBe(true)
      expect(JSON.parse(await readFile(path.join(projectRoot, 'tsconfig.json'), 'utf8'))).toMatchObject({
        include: ['src/**/*.ts', 'benchmark-vant-resolver.ts'],
      })
      expect(JSON.parse(await readFile(path.join(projectRoot, 'tsconfig.node.json'), 'utf8'))).toMatchObject({
        include: ['vite.config.ts', 'benchmark-vant-resolver.ts'],
      })
    }
    finally {
      await rm(projectRoot, { recursive: true, force: true })
    }
  })
})
