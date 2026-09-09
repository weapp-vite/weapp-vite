import { describe, expect, it } from 'vitest'
import { parse, traverse } from '../../../../utils/babel'
import { compileVueFile } from './index'

describe('SFC TypeScript this parameters', () => {
  it.each([
    { name: 'app lifecycle callback', isApp: true, body: `import { onLaunch } from 'wevu'
onLaunch(function (this: { marker: string }) { this.marker = 'launched' })` },
    { name: 'function declaration', body: `function increment(this: { count: number }, delta: number) { this.count += delta }` },
    { name: 'function expression', body: `const increment = function (this: { count: number }, delta = 1) { this.count += delta }` },
    { name: 'object method', body: `const counter = { increment(this: { count: number }, delta: number) { this.count += delta } }` },
    { name: 'class methods', body: `class Counter {
count = 0
increment(this: Counter, delta: number) { this.count += delta }
#reset(this: Counter) { this.count = 0 }
}` },
    { name: 'async callback', body: `const increment = async function (this: { count: number }, delta: number) { this.count += delta }` },
  ])('erases $name receiver parameters and preserves runtime this expressions', async ({ body, isApp = false }) => {
    const result = await compileVueFile(`<script setup lang="ts">\n${body}\n</script>`, '/project/src/receiver.vue', { isApp })
    expect(result.script).toBeTruthy()
    const ast = parse(result.script!, { sourceType: 'module', plugins: [] })
    let runtimeThisCount = 0
    traverse(ast, {
      ThisExpression() { runtimeThisCount++ },
      Function(path) {
        expect(path.node.params.every(param => param.type !== 'Identifier' || param.name !== 'this')).toBe(true)
      },
    })
    expect(runtimeThisCount).toBeGreaterThan(0)
  })
})
