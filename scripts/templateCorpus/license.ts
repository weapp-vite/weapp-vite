import type { CorpusLicense, CorpusLicenseFile } from './types'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { isLicenseGrantFile } from './attributionFiles'
import { corpusHash } from './integrity'

/** 非 UTF-8 归属声明以原始字节保存，显式提供字符集才添加可阅读视图。 */
export function encodeLicenseFile(path: string, bytes: Uint8Array, charset?: string): CorpusLicenseFile {
  const sha256 = corpusHash(bytes)
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
    return { path, text, sha256 }
  }
  catch {
    const decodedText = charset ? new TextDecoder(charset, { fatal: true, ignoreBOM: true }).decode(bytes) : undefined
    return { path, sha256, encoding: 'base64', base64: Buffer.from(bytes).toString('base64'), bytes: bytes.length, charset, decodedText }
  }
}

/** 校验保存的许可字节以及可选阅读视图，不用替换字符修补原文。 */
export function licenseFileBytes(file: CorpusLicenseFile): Uint8Array {
  assert.ok(file.path && !file.path.startsWith('/') && !file.path.includes('\\') && !file.path.includes(':') && file.path.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'Nonportable license source path')
  let bytes: Uint8Array
  if ('encoding' in file) {
    assert.equal(file.encoding, 'base64', 'Unknown license file encoding')
    const decoded = Buffer.from(file.base64, 'base64')
    assert.equal(decoded.toString('base64'), file.base64, 'Noncanonical license base64')
    assert.equal(decoded.length, file.bytes, 'License byte count mismatch')
    bytes = new Uint8Array(decoded)
    if (file.decodedText !== undefined) {
      assert.ok(file.charset, 'Decoded license view needs an explicit charset')
      assert.equal(new TextDecoder(file.charset, { fatal: true, ignoreBOM: true }).decode(bytes), file.decodedText, 'Decoded license view mismatch')
    }
  }
  else {
    assert.equal(typeof file.text, 'string', 'Missing license text')
    bytes = new TextEncoder().encode(file.text)
  }
  assert.equal(corpusHash(bytes), file.sha256, 'License content hash mismatch')
  return bytes
}

function licenseText(file: CorpusLicenseFile): string | undefined {
  return 'encoding' in file ? file.decodedText : file.text
}

/** 识别实际授权正文，标题、SPDX 元数据和来源链接不能单独授权代码。 */
export function identifyLicense(text: string | undefined): string | undefined {
  if (!text) {
    return undefined
  }
  const value = text.replace(/\s+/g, ' ')
  if (/Permission is hereby granted,? free of charge/i.test(value) && /copyright notice and this permission notice/i.test(value) && /THE SOFTWARE IS PROVIDED ["'“‘`]?AS IS/i.test(value)) {
    return 'MIT'
  }
  if (/Apache License,? Version 2\.0/i.test(value) && /Grant of Copyright License|Licensed under the Apache License/i.test(value)) {
    return 'Apache-2.0'
  }
  if (/Redistribution and use in source and binary forms/i.test(value) && /THIS SOFTWARE IS PROVIDED/i.test(value)) {
    return /Neither the name/i.test(value) ? 'BSD-3-Clause' : 'BSD-2-Clause'
  }
  if (/Permission to use, copy, modify,? and(?:\/?or)? distribute/i.test(value) && /for any purpose with or without fee/i.test(value) && /THE SOFTWARE IS PROVIDED/i.test(value)) {
    return /copyright notice and this permission notice/i.test(value) ? 'ISC' : '0BSD'
  }
  const gnu = /GNU (?:(AFFERO|LESSER) )?GENERAL PUBLIC LICENSE.{0,30}?Version ([23](?:\.[01])?)/i.exec(value)
  if (gnu && /TERMS AND CONDITIONS/i.test(value) && /copyright/i.test(value)) {
    const family = gnu[1]?.toUpperCase() === 'AFFERO' ? 'AGPL' : gnu[1]?.toUpperCase() === 'LESSER' ? 'LGPL' : 'GPL'
    return `${family}-${gnu[2]!.includes('.') ? gnu[2] : `${gnu[2]}.0`}-only`
  }
  if (/Mozilla Public License Version 2\.0/i.test(value) && /Exhibit A/i.test(value)) {
    return 'MPL-2.0'
  }
  if (/free and unencumbered software released into the public domain/i.test(value) && /THE SOFTWARE IS PROVIDED/i.test(value)) {
    return 'Unlicense'
  }
  return undefined
}

function grantScope(file: string): string | undefined {
  if (!isLicenseGrantFile(file)) {
    return undefined
  }
  const slash = file.lastIndexOf('/')
  return slash < 0 ? '' : file.slice(0, slash)
}

export interface TemplateLicenseDecision {
  confirmed: boolean
  path?: string
  spdx?: string
  reason?: string
  evidence: string[]
}

/** 最近目录的未知 LICENSE 会阻断祖先继承，依赖许可永远不能授权祖先代码。 */
export function resolveTemplateLicense(templatePath: string, license: CorpusLicense): TemplateLicenseDecision {
  const candidates = license.files.flatMap((file) => {
    const scope = grantScope(file.path)
    return scope !== undefined && (!scope || templatePath.startsWith(`${scope}/`)) ? [{ file, scope }] : []
  })
  if (!candidates.length) {
    return { confirmed: false, reason: 'no-ancestor-license-grant', evidence: [] }
  }
  const nearest = Math.max(...candidates.map(item => item.scope.length))
  const scoped = candidates.filter(item => item.scope.length === nearest)
  const grants = scoped.flatMap(({ file }) => {
    const spdx = identifyLicense(licenseText(file))
    return spdx ? [{ file, spdx }] : []
  })
  const evidence = scoped.map(({ file }) => `license-scope:${file.path}:${file.sha256}`)
  if (!grants.length) {
    return { confirmed: false, reason: 'nearest-license-grant-unconfirmed', evidence }
  }
  const identifiers = [...new Set(grants.map(grant => grant.spdx))]
  if (identifiers.length > 1 && !identifiers.every(id => license.spdx.includes(id))) {
    return { confirmed: false, reason: 'multiple-license-grants-require-confirmed-expression', evidence }
  }
  const spdx = identifiers.length > 1 ? license.spdx : identifiers[0]!
  if (nearest === 0 && !license.spdx.includes(spdx) && !spdx.startsWith(`${license.spdx}-`)) {
    return { confirmed: false, reason: 'declared-root-license-does-not-match-grant', evidence }
  }
  return { confirmed: true, path: grants[0]!.file.path, spdx, evidence }
}
