import { fileURLToPath } from 'node:url'
import { defineConfig } from 'weapp-vite'

export default defineConfig({
  build: { minify: false },
  plugins: [{
    name: 'issue-1034-module-evidence',
    generateBundle(_options, bundle) {
      const root = fileURLToPath(new URL('./src/', import.meta.url)).replaceAll('\\', '/')
      const modules = [...this.getModuleIds()].filter(id => id.replaceAll('\\', '/').startsWith(root) && !id.includes('?')).map(id => ({
        id: id.replaceAll('\\', '/').slice(root.length),
        chunks: Object.values(bundle).filter(output => output.type === 'chunk' && id in output.modules).map(output => output.fileName),
      }))
      const scope = modules.some(module => module.id === 'app.vue') ? 'main' : 'isolated'
      this.emitFile({ type: 'asset', fileName: `issue-1034-${scope}-modules.json`, source: JSON.stringify({ modules }, null, 2) })
    },
  }],
  weapp: {
    srcRoot: 'src',
    autoRoutes: { extensions: ['vue'], persistentCache: true },
    subPackages: { 'subpackages/account': {}, 'subpackages/isolated': { independent: true } },
  },
})
