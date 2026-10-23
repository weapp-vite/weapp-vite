import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- execa 负责 Windows pnpm shim 的跨平台启动。
import { execa } from 'execa'
import { resolveSmokeSource } from './source.mjs'

const expectedCommit = process.env.CREATE_WEAPP_VITE_SOURCE_COMMIT?.trim()
if (!expectedCommit || !process.env.RUNNER_TEMP || !process.env.GITHUB_OUTPUT) {
  throw new Error('Workspace smoke packing requires a frozen commit and GitHub runner outputs')
}
const { stdout: actualCommit } = await execa('git', ['rev-parse', 'HEAD'])
if (actualCommit !== expectedCommit) {
  throw new Error('The workspace checkout no longer matches the frozen smoke commit')
}
const outputDir = await fs.mkdtemp(path.join(process.env.RUNNER_TEMP, 'create-weapp-vite-workspace-'))
await execa('pnpm', ['--filter', 'create-weapp-vite', 'pack', '--pack-destination', outputDir], { stdio: 'inherit' })
const files = (await fs.readdir(outputDir)).filter(file => file.endsWith('.tgz'))
if (files.length !== 1) {
  throw new Error('Workspace smoke must produce exactly one scaffold tarball')
}
const tarball = path.join(outputDir, files[0])
const identity = await resolveSmokeSource({ source: 'workspace', sourceCommit: expectedCommit, tarball })
const { stdout: packedCommit } = await execa('git', ['rev-parse', 'HEAD'])
if (packedCommit !== expectedCommit) {
  throw new Error('The workspace commit changed while packing the scaffold')
}
await fs.appendFile(process.env.GITHUB_OUTPUT, [
  `tarball=${tarball}`,
  `tarball_sha256=${identity.tarballSha256}`,
  `source_commit=${identity.sourceCommit}`,
  '',
].join('\n'))
