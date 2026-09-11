/* eslint-disable antfu/if-newline, curly, style/brace-style */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const roots = ['packages', 'packages-runtime', '@weapp-core', 'mpcore/packages']
const repoUrl = 'git+https://github.com/weapp-vite/weapp-vite.git'
const issues = []
const packages = []

function walkExports(value, key = 'exports') {
  if (typeof value === 'string') return [value]
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([k, v]) => walkExports(v, `${key}.${k}`))
}

for (const root of roots) {
  const dir = path.resolve(root)
  if (!fs.existsSync(dir)) continue
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = path.join(dir, entry.name, 'package.json')
    if (!fs.existsSync(file)) continue
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (pkg.private === true) continue
    packages.push({ file, pkg })
  }
}

for (const { file, pkg } of packages) {
  const rel = path.relative(process.cwd(), file)
  if (!pkg.name || !pkg.description || pkg.description.length < 10) issues.push(`${rel}: description is missing or too short`)
  if (!Array.isArray(pkg.keywords) || pkg.keywords.length < 3) issues.push(`${rel}: keywords are missing`)
  if (!pkg.repository || pkg.repository.url !== repoUrl || pkg.repository.directory !== path.dirname(rel)) issues.push(`${rel}: repository metadata is invalid`)
  if (!pkg.homepage) issues.push(`${rel}: homepage is missing`)
  if (!pkg.bugs?.url?.includes('/issues')) issues.push(`${rel}: bugs.url is missing`)
  if (pkg.publishConfig?.access !== 'public' || pkg.publishConfig?.registry !== 'https://registry.npmjs.org') issues.push(`${rel}: publishConfig must declare public npmjs publishing`)
  const packageRoot = path.dirname(file)
  const entries = [...walkExports(pkg.exports), pkg.main, pkg.module, pkg.types]
  if (pkg.bin && typeof pkg.bin === 'string') entries.push(pkg.bin)
  if (pkg.bin && typeof pkg.bin === 'object') entries.push(...Object.values(pkg.bin))
  for (const target of entries.filter(Boolean)) {
    if (!target.includes('*') && !fs.existsSync(path.resolve(packageRoot, target))) issues.push(`${rel}: missing entry ${target}`)
  }
}

if (issues.length) {
  console.error(issues.map(issue => `✗ ${issue}`).join('\n'))
  process.exitCode = 1
} else {
  console.log(`✓ ${packages.length} publishable package manifests passed metadata and entry checks`)
}
