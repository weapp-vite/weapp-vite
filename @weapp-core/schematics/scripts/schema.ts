import fs from 'fs-extra'
import path from 'pathe'
import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema } from '../src/json'

const websiteHostPath = path.resolve(import.meta.dirname, '../../../website/public')

function outputJSON(p: string, data: any) {
  return fs.outputJSON(path.resolve(websiteHostPath, p), data, {
    spaces: 2,
  })
}

await outputJSON('app.json', AppJsonSchema)
await outputJSON('component.json', ComponentJsonSchema)
await outputJSON('page.json', PageJsonSchema)
