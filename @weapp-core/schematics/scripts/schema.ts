import fs from 'fs-extra'
import { compileFromFile } from 'json-schema-to-typescript'
import path from 'pathe'
import { AppJsonSchema, ComponentJsonSchema, PageJsonSchema } from './json'

const websiteHostPath = path.resolve(import.meta.dirname, '../../../website/public')

async function outputJSON(p: string, data: any) {
  const filename = path.resolve(websiteHostPath, p)
  await fs.outputJSON(filename, data, {
    spaces: 2,
  })
  return filename
}

const typesCodeArray: string[] = []

for (const { name, schema } of [
  {
    name: 'app.json',
    schema: AppJsonSchema,
  },
  {
    name: 'component.json',
    schema: ComponentJsonSchema,
  },
  {
    name: 'page.json',
    schema: PageJsonSchema,
  },
]) {
  const filename = await outputJSON(name, schema)
  typesCodeArray.push(await compileFromFile(filename))
}

await fs.writeFile(path.resolve(import.meta.dirname, '../src/type.auto.ts'), typesCodeArray.join('\n'), 'utf8')
