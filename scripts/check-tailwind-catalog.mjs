import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const roots = ['apps', 'e2e-apps', 'templates', 'packages', 'packages-runtime', '@weapp-core', 'mpcore', 'test/fixture-projects']
const failures = []
for (const root of roots) {
  const base = path.resolve(root)
  if (!fs.existsSync(base)) continue
  const stack = [base]
  while (stack.length) {
    const dir = stack.pop()
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.tmp') continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.name === 'package.json') {
        const pkg = JSON.parse(fs.readFileSync(full, 'utf8'))
        const spec = [...Object.values(pkg.dependencies ?? {}), ...Object.values(pkg.devDependencies ?? {}), ...Object.values(pkg.peerDependencies ?? {})]
        if (spec.some(value => typeof value === 'string' && (/tailwind3|tailwindcss.*(?:^|[~<>= ])3\./i.test(value)))) failures.push(path.relative(process.cwd(), full))
      }
    }
  }
}
if (failures.length) {
  console.error(`Tailwind CSS 3 references found:\n${failures.map(file => `- ${file}`).join('\n')}`)
  process.exitCode = 1
} else console.log('✓ no Tailwind CSS 3 package references found')
