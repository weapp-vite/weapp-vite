import process from 'node:process'
import { syncPackageSkills } from './distribution.mjs'

await syncPackageSkills(process.argv[2])
