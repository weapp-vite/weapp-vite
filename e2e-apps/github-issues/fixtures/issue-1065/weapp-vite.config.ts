import { defineConfig } from 'weapp-vite'
import { fakeProvider } from './fakeProvider'

export default defineConfig({
  build: { minify: false },
  // 诊断日志不能成为触发下一轮编译的输入。
  server: { watch: { ignored: [/[/\\]provider-events\.jsonl$/] } },
  weapp: { srcRoot: 'src', compilerPlugins: [fakeProvider()] },
})
