import process from 'node:process'
import { defineConfig } from 'weapp-vite/config'

const webHost = process.env.WEAPP_WEB_HOST
const portValue = process.env.WEAPP_WEB_PORT
const parsedPort = portValue ? Number.parseInt(portValue, 10) : undefined
const webPort = Number.isFinite(parsedPort) ? parsedPort : undefined
const shouldOpen = process.env.WEAPP_WEB_OPEN === 'true'

export default defineConfig({
  weapp: {
    srcRoot: 'src',
    autoImportComponents: {
      globs: [
        'components/**/*.wxml',
        'components/**/*.html',
      ],
      typedComponents: 'typed-components.d.ts',
      htmlCustomData: 'mini-program.html-data.json',
    },
    web: {
      vite: {
        server: {
          host: webHost ?? '127.0.0.1',
          port: webPort ?? 5173,
          open: shouldOpen,
        },
      },
    },
  },
})
