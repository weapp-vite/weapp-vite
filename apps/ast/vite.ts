import { build } from 'vite'

async function main() {
  await build({

    build: {
      rollupOptions: {
        input: {
          app: 'src/app.ts',
        },
        output: {
          chunkFileNames(chunkInfo) {
            return chunkInfo.name
          },
          entryFileNames(chunkInfo) {
            return `${chunkInfo.name}.js`
          },
          assetFileNames(chunkInfo) {
            return chunkInfo.names[0]
          },
        },

      },
      assetsDir: '',

    },
  })
}

main()
