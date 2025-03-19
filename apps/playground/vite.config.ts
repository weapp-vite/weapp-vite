import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: './src/index.ts',
      },
    },
  },
  plugins: [
    {
      name: 'test',
      configResolved(config) {
        // console.log(config)
      },
      async  buildStart(options) {
        await this.load(
          {
            id: './src/pages/index.ts',
          },
        )
      },
      load(id, options) {
        console.log(id)
      },
      transform(code, id, options) {
        console.log(id)
        // this.getModuleInfo(id)
        // this.getModuleInfo(id).
      },
    },
  ],
})
