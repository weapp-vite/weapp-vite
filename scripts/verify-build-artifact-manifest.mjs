import fs from 'node:fs'
import process from 'node:process'

const manifestPath = '.tmp/build-artifact-manifest.json'
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const expected = {
  commit: process.env.BUILD_ARTIFACT_EXPECTED_COMMIT ?? process.env.GITHUB_SHA ?? '',
  nodeMajor: process.env.BUILD_ARTIFACT_EXPECTED_NODE_MAJOR ?? process.versions.node.split('.')[0],
  os: process.env.BUILD_ARTIFACT_EXPECTED_OS ?? process.env.RUNNER_OS ?? process.platform,
}

for (const key of Object.keys(expected)) {
  if (manifest[key] !== expected[key]) {
    throw new Error(`Build artifact manifest mismatch for ${key}: expected ${expected[key]}, received ${manifest[key]}`)
  }
}

if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
  throw new Error('Build artifact manifest contains no outputs')
}

for (const file of manifest.files) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing build artifact output: ${file}`)
  }
}

console.log(`Verified ${manifest.files.length} workspace build outputs for ${manifest.os} / Node ${manifest.nodeMajor}`)
