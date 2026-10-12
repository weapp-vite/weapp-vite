import { execFile } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const execFileAsync = promisify(execFile)
const packageDirectory = fileURLToPath(new URL('../', import.meta.url))

it('keeps Babel transforms unloaded until an actual JSX compilation through published entries', async () => {
  // 全新进程消费发布入口；源码 mock 无法证明 bundler 保留了动态加载边界。
  const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '--eval', `
    import assert from 'node:assert/strict'
    import path from 'node:path'
    import { registerHooks } from 'node:module'
    import { fileURLToPath } from 'node:url'
    const loaded = new Set()
    const hooks = registerHooks({
      load(url, context, nextLoad) {
        const file = url.startsWith('file:') ? fileURLToPath(url).replaceAll('\\\\', '/') : url
        if (file.includes('/@babel/core/') || file.includes('/@vue/babel-plugin-jsx/')
          || file.includes('/@babel/plugin-transform-modules-commonjs/')
          || file.includes('/@babel/preset-env/')) loaded.add(file)
        return nextLoad(url, context)
      },
    })
    try {
      await import('weapp-vite')
      const { compileVueFile, compileJsxFile } = await import('wevu/compiler')
      assert.deepEqual([...loaded], [], 'ordinary host imports must not load optional Babel transforms')
      const plain = await compileVueFile(
        '<script setup lang="ts">const title: string = "plain"</script><template><view>{{ title }}</view></template>',
        path.resolve('src/pages/plain.vue'),
      )
      assert.ok(plain.script && plain.template.includes('<view>'))
      assert.deepEqual([...loaded], [], 'ordinary SFC compilation must not load optional Babel transforms')
      const jsx = await compileJsxFile('export const content = <view>jsx</view>', path.resolve('src/content.tsx'))
      assert.ok(jsx.script.includes('createVNode') && !jsx.script.includes('<view>'))
      assert.ok([...loaded].some(file => file.includes('/@babel/core/')))
      assert.ok([...loaded].some(file => file.includes('/@vue/babel-plugin-jsx/')))
      console.log('compiler-dependency-loading-ok')
    }
    finally {
      hooks.deregister()
    }
  `], { cwd: packageDirectory, timeout: 20_000 })
  expect(stdout.trim()).toBe('compiler-dependency-loading-ok')
}, 25_000)
