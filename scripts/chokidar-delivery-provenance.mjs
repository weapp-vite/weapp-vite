import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- Git 来源核验必须在各平台正确解析可执行文件。
import { execa } from 'execa'
import { readConsumerTarballs } from '../packages/weapp-vite/scripts/consumerTarballs.mjs'

const digest = contents => createHash('sha256').update(contents).digest('hex')

/** 绑定独立 checkout、冻结锁文件和真实归档，不修改源码、构建产物或安装目录。 */
export async function recordDeliveryProvenance({ variant, sourceRoot, tarballRoot, expectedSha }) {
  assert(['candidate', 'baseline'].includes(variant), 'Unknown delivery variant')
  assert.match(expectedSha ?? '', /^[\da-f]{40}$/i, 'A frozen source SHA is required')
  const root = await realpath(sourceRoot)
  const source = (await execa('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim()
  assert.equal(source, expectedSha, 'Delivery checkout differs from its frozen source')
  const trackedStatus = (await execa('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root })).stdout
  assert.equal(trackedStatus, '', 'Delivery source has tracked modifications')
  const modules = path.join(root, 'node_modules')
  assert((await lstat(modules)).isDirectory(), 'Delivery checkout requires its own node_modules directory')
  assert.equal(await realpath(modules), modules, 'Delivery checkout cannot borrow another node_modules tree')
  const candidates = await readConsumerTarballs(tarballRoot, ['weapp-vite'])
  const archives = await Promise.all(Object.entries(candidates).map(async ([name, specifier]) => {
    const file = specifier.slice('file:'.length)
    const contents = await readFile(file)
    return { name, file: path.basename(file), bytes: contents.length, sha256: digest(contents) }
  }))
  archives.sort((left, right) => left.name.localeCompare(right.name))
  const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  return {
    schemaVersion: 1,
    variant,
    sourceSha: source,
    trackedSourceClean: true,
    independentNodeModules: true,
    node: process.version,
    platform: process.platform,
    packageManager: manifest.packageManager,
    lockfileSha256: digest(await readFile(path.join(root, 'pnpm-lock.yaml'))),
    tarballManifestSha256: digest(await readFile(path.join(tarballRoot, 'consumer-tarballs.json'))),
    archives,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [variant, sourceRoot, tarballRoot, reportFile] = process.argv.slice(2)
  assert(variant && sourceRoot && tarballRoot && reportFile, 'Usage: chokidar-delivery-provenance.mjs <candidate|baseline> <source> <tarballs> <report>')
  const report = await recordDeliveryProvenance({ variant, sourceRoot, tarballRoot, expectedSha: process.env.WEAPP_VITE_DELIVERY_EXPECTED_SHA })
  await mkdir(path.dirname(reportFile), { recursive: true })
  await writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`)
}
