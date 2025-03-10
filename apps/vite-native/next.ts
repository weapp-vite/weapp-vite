import MagicString from 'magic-string'
import { build } from 'vite'

const virtualModuleId = 'virtual:pages'
const resolvedVirtualModuleId = `\0${virtualModuleId}`
async function main() {
  build({
    root: import.meta.dirname,
    configFile: false,
    build: {
      outDir: 'dist-next',
      rollupOptions: {
        input: {
          app: 'app.js',
        },
        external: ['@weapp-tailwindcss/merge', 'dayjs', 'lodash', '@/assets/logo.png'],

      },
      minify: false,
    },
    plugins: [
      {
        name: 'test',
        resolveId(id) {
          if (id === virtualModuleId) {
            return resolvedVirtualModuleId
          }
        },
        load(id) {
          if (id === resolvedVirtualModuleId) {
            return `import './pages/index/index.ts'`
          }
        },
        transform(code, id) {
          if (id.endsWith('app.js')) {
            const ms = new MagicString(code)
            ms.prepend(`import '${virtualModuleId}'\n`)
            return {
              code: ms.toString(),
            }
          }
        },
      },
    ],
  })
}

main()
