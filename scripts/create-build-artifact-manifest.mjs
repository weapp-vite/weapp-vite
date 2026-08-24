import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const rootDir = process.cwd()
const outputPath = path.join(rootDir, '.tmp/build-artifact-manifest.json')
const outputPatterns = [
  'packages',
  'packages-runtime',
  'packages-private',
  '@weapp-core',
  'benchmarks',
  'mpcore/packages',
]

function collectDistFiles(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir)
  if (!fs.existsSync(absoluteDir)) {
    return []
  }

  const files = []
  const visit = (currentDir) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name)
      if (entry.isDirectory()) {
        visit(absolutePath)
      }
      else if (absolutePath.includes(`${path.sep}dist${path.sep}`) || absolutePath.includes(`${path.sep}bin${path.sep}`)) {
        files.push(path.relative(rootDir, absolutePath).replaceAll(path.sep, '/'))
      }
    }
  }
  visit(absoluteDir)
  return files
}

const files = outputPatterns.flatMap(collectDistFiles).sort()
if (files.length === 0) {
  throw new Error('No workspace build outputs found for artifact manifest')
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, `${JSON.stringify({
  commit: process.env.GITHUB_SHA ?? '',
  nodeMajor: process.versions.node.split('.')[0],
  os: process.env.RUNNER_OS ?? process.platform,
  files,
}, null, 2)}\n`)
