import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { exec } from 'tinyexec'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const appRoot = path.resolve(import.meta.dirname, '..')
const negativePage = 'src/pages/typecheck-errors/index.vue'

it('keeps exactly the four intentional type errors in the managed app config', async () => {
  // 与 postinstall 使用同一已构建 CLI，确保新 checkout 也具备受管类型支持。
  await exec(process.execPath, [require.resolve('weapp-vite/bin/weapp-vite.js'), 'prepare'], {
    nodeOptions: { cwd: appRoot },
    throwOnError: true,
    timeout: 30_000,
  })
  const result = await exec(process.execPath, [
    require.resolve('vue-tsc/bin/vue-tsc.js'),
    '--noEmit',
    '--pretty',
    'false',
    '-p',
    '.weapp-vite/tsconfig.app.json',
  ], { nodeOptions: { cwd: appRoot }, throwOnError: false, timeout: 60_000 })
  const output = `${result.stdout}\n${result.stderr}`.replace(/\r\n/g, '\n')
  const source = (await readFile(path.join(appRoot, negativePage), 'utf8')).split(/\r?\n/)
  const matches = [...output.matchAll(/^(.*?)\((\d+),\d+\): error TS(\d+):/gm)]
  const diagnostics = matches.map(([, file, line, code]) => ({
    file: path.relative(appRoot, path.resolve(appRoot, file!)).replace(/\\/g, '/'),
    code: Number(code),
    statement: source[Number(line) - 1]?.trim(),
  }))

  expect(result.exitCode, output).toBe(2)
  expect(output.match(/error TS\d+:/g), output).toHaveLength(4)
  expect(diagnostics, output).toEqual([
    { file: negativePage, code: 2345, statement: 'const badRef = ref<number>(\'oops\')' },
    { file: negativePage, code: 2769, statement: 'const badComputed = computed<number>(() => props.title)' },
    { file: negativePage, code: 2345, statement: 'const fromString = takesNumber(props.title)' },
    { file: negativePage, code: 2322, statement: 'const badUnion: \'a\' | \'b\' = \'c\'' },
  ])
}, 90_000)
