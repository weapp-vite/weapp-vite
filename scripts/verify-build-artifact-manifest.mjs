import fs from 'node:fs'
import process from 'node:process'
import { verifyBuildArtifactManifest } from './buildArtifact/index.mjs'

const manifest = verifyBuildArtifactManifest(process.cwd(), JSON.parse(fs.readFileSync('.tmp/build-artifact-manifest.json', 'utf8')))
console.log(`Verified ${manifest.files.length} workspace build outputs for ${manifest.os} / Node ${manifest.nodeMajor}`)
