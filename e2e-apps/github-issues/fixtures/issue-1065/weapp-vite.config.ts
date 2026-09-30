import { defineConfig } from 'weapp-vite'
import { fakeProvider } from './fakeProvider'

export default defineConfig({
  build: { minify: false },
  weapp: { srcRoot: 'src', compilerPlugins: [fakeProvider()] },
})
