import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
// eslint-disable-next-line e18e/ban-dependencies -- 需要固定 shell:false 的跨平台 git 身份调用。
import { execa } from 'execa'
import { verifyAddonFiles } from './addon.mjs'
import { loadManifest } from './manifest.mjs'

export const driverRoot = fileURLToPath(new URL('../../', import.meta.url))

export async function readCommit(root) {
  const { stdout } = await execa('git', ['rev-parse', 'HEAD'], { cwd: root })
  if (!/^[a-f\d]{40}$/u.test(stdout)) {
    throw new Error('Missing full checkout commit identity')
  }
  return stdout
}

export async function currentPlan(root, commit = readCommit) {
  const { manifest, bytes } = await loadManifest(root)
  const testedCommit = await commit(root)
  const driverCommit = await commit(driverRoot)
  if (process.env.NATIVE_CORRECTNESS_EXPECTED_COMMIT && testedCommit !== process.env.NATIVE_CORRECTNESS_EXPECTED_COMMIT) {
    throw new Error('Native correctness checkout differs from the frozen PR context')
  }
  if (process.env.NATIVE_CORRECTNESS_DRIVER_COMMIT && driverCommit !== process.env.NATIVE_CORRECTNESS_DRIVER_COMMIT) {
    throw new Error('Native correctness driver differs from the workflow commit')
  }
  return {
    schemaVersion: 1,
    testedCommit,
    driverCommit,
    manifestSha256: createHash('sha256').update(bytes).digest('hex'),
    manifest,
  }
}

export const readJson = async (directory, name) => JSON.parse(await readFile(path.join(directory, name), 'utf8'))
export const writeJson = (directory, name, value) => writeFile(path.join(directory, name), `${JSON.stringify(value, null, 2)}\n`)

export async function frozenPlan(root, directory, commit) {
  const plan = await readJson(directory, 'plan.json')
  if (!isDeepStrictEqual(plan, await currentPlan(root, commit))) {
    throw new Error('Native correctness plan changed after preflight')
  }
  return plan
}

export function bindingIdentity(plan) {
  return {
    testedCommit: plan.testedCommit,
    driverCommit: plan.driverCommit,
    manifestSha256: plan.manifestSha256,
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
  }
}

export async function requireBinding(root, directory, plan) {
  const binding = await readJson(directory, 'binding.json')
  if (!isDeepStrictEqual(binding, { status: 'passed', ...bindingIdentity(plan), exports: plan.manifest.requiredExports, addonFiles: binding.addonFiles })) {
    throw new Error('Required actual-addon export preflight did not pass')
  }
  return verifyAddonFiles(root, binding.addonFiles)
}
