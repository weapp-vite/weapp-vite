import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { it } from 'vitest'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')
const PROJECT_CONFIG_RE = /(?:^|\/)project\.config\.json$/
const PRIVATE_PROJECT_CONFIG_RE = /(?:^|\/)project\.private\.config\.json$/
const SWAN_PROJECT_CONFIG_RE = /(?:^|\/)project\.swan\.json$/
const UNSUPPORTED_PROJECT_CONFIG_RE = /\/config\/(?:jd|xhs)\/project\.config\.json$/

function listTrackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr || 'git ls-files failed')
  return result.stdout.split('\0').filter(Boolean)
}

function isSupportedProjectConfig(file: string) {
  if (SWAN_PROJECT_CONFIG_RE.test(file)) {
    return true
  }

  if (PRIVATE_PROJECT_CONFIG_RE.test(file)) {
    return true
  }

  return PROJECT_CONFIG_RE.test(file) && !UNSUPPORTED_PROJECT_CONFIG_RE.test(file)
}

function readUrlCheck(file: string) {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, file), 'utf8')) as {
    setting?: { urlCheck?: unknown }
  }
  return config.setting?.urlCheck
}

function resolveEffectiveUrlCheck(file: string, trackedFiles: Set<string>) {
  const privateFile = path.posix.join(path.posix.dirname(file), 'project.private.config.json')
  if (trackedFiles.has(privateFile)) {
    return readUrlCheck(privateFile)
  }

  return readUrlCheck(file)
}

it('keeps legal-domain validation disabled for every supported mini-program project', () => {
  const trackedFiles = new Set(listTrackedFiles())
  const projectFiles = [...trackedFiles].filter(isSupportedProjectConfig)
  const publicProjectFiles = projectFiles.filter(file => !PRIVATE_PROJECT_CONFIG_RE.test(file))
  const explicitTrueFiles = projectFiles.filter(file => readUrlCheck(file) === true)
  const effectiveTrueFiles = publicProjectFiles.filter(file => resolveEffectiveUrlCheck(file, trackedFiles) !== false)

  assert.deepEqual(explicitTrueFiles, [])
  assert.deepEqual(effectiveTrueFiles, [])
})
