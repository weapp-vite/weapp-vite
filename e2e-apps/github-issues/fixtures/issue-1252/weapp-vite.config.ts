import { defineConfig } from 'weapp-vite'

export default defineConfig({ weapp: { srcRoot: 'src', autoRoutes: false, npm: { enable: false }, web: { enable: true } } })
