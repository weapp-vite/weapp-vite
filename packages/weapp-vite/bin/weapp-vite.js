#!/usr/bin/env node
import process from 'node:process'
import { runWeappViteCLI } from './bootstrap.js'

runWeappViteCLI().catch((error) => {
  process.nextTick(() => {
    throw error
  })
})
