import { readFileSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const policyPath = fileURLToPath(new URL('../ci-toolchain.json', import.meta.url))
const packagePath = `${root}/package.json`

export function readCiToolchain() {
  const policy = JSON.parse(readFileSync(policyPath, 'utf8'))
  validateCiToolchain(policy)
  return policy
}

function versionParts(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value))
  if (!match) {
    throw new Error(`Invalid Node version: ${value}`)
  }
  return match.slice(1).map(Number)
}

function compareVersions(left, right) {
  const a = versionParts(left)
  const b = versionParts(right)
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) {
      return a[index] - b[index]
    }
  }
  return 0
}

function satisfiesNodeEngine(version, engine) {
  const candidate = versionParts(version)
  return engine.split(' || ').some((range) => {
    const normalized = range.trim()
    const caret = /^\^(\d+)\.(\d+)\.(\d+)$/u.exec(normalized)
    const minimum = /^>=(\d+)\.(\d+)\.(\d+)$/u.exec(normalized)
    if (!caret && !minimum) {
      throw new Error(`Unsupported Node engine range: ${normalized}`)
    }
    const floor = (caret ?? minimum).slice(1).map(Number)
    if (compareVersions(version, floor.join('.')) < 0) {
      return false
    }
    return !caret || candidate[0] === floor[0]
  })
}

export function validateCiToolchain(policy) {
  if (policy.version !== 1) {
    throw new Error('Unsupported CI toolchain policy version')
  }
  for (const name of ['ubuntu', 'windows', 'macos']) {
    if (typeof policy.runners?.[name] !== 'string' || !policy.runners[name]) {
      throw new Error(`Missing runner policy: ${name}`)
    }
  }
  if (new Set(Object.values(policy.runners)).size !== 3) {
    throw new Error('Runner policy must contain unique labels')
  }
  if (policy.runners.macos === 'macos-latest') {
    throw new Error('macOS CI must use a pinned runner label')
  }
  const defaultVersion = readFileSync(`${root}/.node-version`, 'utf8').trim()
  const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
  const engine = packageJson.engines?.node
  if (typeof engine !== 'string' || !engine) {
    throw new Error('Root package must declare a Node engine')
  }
  if (policy.node?.default !== defaultVersion) {
    throw new Error(`CI default Node version must match .node-version (${defaultVersion})`)
  }
  if (!satisfiesNodeEngine(defaultVersion, engine)) {
    throw new Error(`CI default Node version is outside package engine (${defaultVersion})`)
  }
  const majors = policy.node?.supportMajors
  if (!Array.isArray(majors) || majors.length !== 3 || new Set(majors).size !== majors.length) {
    throw new Error('Node support majors must contain three unique entries')
  }
  for (const major of majors) {
    const key = String(major)
    const preferred = policy.node.preferred?.[key]
    const minimum = policy.node.minimum?.[key]
    if (!preferred || !minimum || !Number.isInteger(major) || Number(versionParts(preferred)[0]) !== major || Number(versionParts(minimum)[0]) !== major) {
      throw new Error(`Incomplete Node ${major} policy`)
    }
    if (compareVersions(preferred, minimum) < 0) {
      throw new Error(`Node ${major} preferred version is below its minimum`)
    }
    if (!satisfiesNodeEngine(minimum, engine) || !satisfiesNodeEngine(preferred, engine)) {
      throw new Error(`Node ${major} policy is outside package engine`)
    }
  }
  if (!majors.includes(Number(policy.node?.ci))) {
    throw new Error('CI Node major must be one of the support majors')
  }
  if (!Array.isArray(policy.bun?.matrix) || policy.bun.matrix.length !== 2 || new Set(policy.bun.matrix).size !== 2) {
    throw new Error('Bun matrix must contain two unique entries')
  }
  for (const value of [policy.parallel?.default, policy.parallel?.macos]) {
    if (!Number.isInteger(value) || value < 1) {
      throw new Error('CI parallel limits must be positive integers')
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const policy = readCiToolchain()
  if (process.argv[2] === 'check') {
    process.stdout.write('CI toolchain policy is valid\n')
  }
  else if (process.argv[2] === 'export') {
    process.stdout.write(`policy=${JSON.stringify(policy)}\n`)
  }
  else {
    throw new Error('Usage: ci-toolchain.mjs <check|export>')
  }
}
