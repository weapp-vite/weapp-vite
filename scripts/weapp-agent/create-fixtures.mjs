import { execFileSync } from 'node:child_process'
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const destination = path.join(repository, '.cache/acceptance-fixtures')
const { appid } = JSON.parse(await readFile(path.join(repository, 'e2e-apps/github-issues/project.config.json'), 'utf8'))
for (const kind of ['native', 'wevu']) {
  const root = path.join(destination, kind)
  await mkdir(path.join(root, 'src/pages/agent-proof'), { recursive: true })
  await mkdir(path.join(root, 'node_modules'), { recursive: true })
  for (const [name, location] of [['weapp-vite', 'packages/weapp-vite'], ...(kind === 'wevu' ? [['wevu', 'packages-runtime/wevu']] : [])]) {
    await symlink(path.join(repository, location), path.join(root, 'node_modules', name), process.platform === 'win32' ? 'junction' : 'dir').catch((error) => {
      if (error.code !== 'EEXIST') {
        throw error
      }
    })
  }
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: `acceptance-${kind}`, private: true, type: 'module', scripts: { build: 'node node_modules/weapp-vite/bin/weapp-vite.js build' }, dependencies: { 'weapp-vite': '7.4.0', ...(kind === 'wevu' ? { wevu: '1' } : {}) } }, null, 2))
  await writeFile(path.join(root, 'vite.config.ts'), `import { defineConfig } from 'weapp-vite'\nexport default defineConfig({ weapp: { srcRoot: 'src' } })\n`)
  await writeFile(path.join(root, 'project.config.json'), JSON.stringify({ appid, projectname: `acceptance-${kind}`, compileType: 'miniprogram', miniprogramRoot: 'dist/', setting: { es6: true, minified: false, urlCheck: false } }, null, 2))
  await writeFile(path.join(root, 'project.private.config.json'), JSON.stringify({ condition: { miniprogram: { list: [{ name: 'Agent acceptance', pathName: 'pages/agent-proof/index', query: '' }] } } }, null, 2))
  await writeFile(path.join(root, 'src/app.ts'), 'App({})\n')
  await writeFile(path.join(root, 'src/app.json'), JSON.stringify({ pages: ['pages/agent-proof/index'], window: { navigationBarTitleText: 'Acceptance' } }))
  if (kind === 'native') {
    await writeFile(path.join(root, 'src/pages/agent-proof/index.ts'), 'Page({ data: { count: 0 }, increment() { this.setData({ count: this.data.count + 1 }); console.log("acceptance-counter", this.data.count) } })\n')
    await writeFile(path.join(root, 'src/pages/agent-proof/index.wxml'), '<view><text id="count">{{count}}</text><button id="increment" bindtap="increment">Increment</button></view>')
    await writeFile(path.join(root, 'src/pages/agent-proof/index.json'), '{}')
  }
  else {
    await writeFile(path.join(root, 'src/pages/agent-proof/index.vue'), '<script setup lang="ts">\nimport { ref } from "wevu"\nconst count = ref(0)\nfunction increment() { count.value++; console.log("acceptance-counter", count.value) }\n</script>\n<template><view><text id="count">{{count}}</text><button id="increment" @tap="increment">Increment</button></view></template>\n')
  }
  // Generate managed TypeScript support before acceptance records its source snapshot.
  execFileSync(process.execPath, [path.join(repository, 'packages/weapp-vite/bin/weapp-vite.js'), 'prepare', root], { stdio: 'inherit' })
  console.log(root)
}
