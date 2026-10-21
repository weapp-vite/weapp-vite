import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createBuildArtifactManifest } from './buildArtifact/index.mjs'

const root = process.cwd()
const output = path.join(root, '.tmp/build-artifact-manifest.json')
const manifest = createBuildArtifactManifest(root)
fs.mkdirSync(path.dirname(output), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`)
