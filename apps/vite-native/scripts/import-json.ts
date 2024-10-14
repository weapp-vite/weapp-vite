import { require } from 'tsx/cjs/api'
import { tsImport } from 'tsx/esm/api'

const loaded = await tsImport('../pages/index/test.json.ts', import.meta.url)
const tsLoaded = require('../pages/index/test.json.ts', import.meta.url)
console.log(loaded, tsLoaded)
// const loadedAgain = await tsImport('./file.ts', import.meta.url)
