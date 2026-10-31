/* eslint ts/no-require-imports: ["error", { allowAsImport: true }] -- export = 包装器需要准确引用 CommonJS 插件声明 */
import plugin = require('@weapp-vite/volar')

export = plugin
