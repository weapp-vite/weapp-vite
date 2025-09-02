import { defineConfig } from 'weapp-vite/config'

export default defineConfig(() => {
  console.log('[subPackages] packageB config load!')
  return {
    define: {
      'process.env.NODE_ENV': '"packageB"',
      'process.env.VITE_APP_NAME': '"vite-app-packageB"',
      'process.env.VITE_APP_VERSION': '"1.0.0"'
    }
  }
})