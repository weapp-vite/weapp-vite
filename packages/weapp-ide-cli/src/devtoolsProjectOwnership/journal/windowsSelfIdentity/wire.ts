import type { ManagedWechatHostIdentity } from '../../types'
import { Buffer } from 'node:buffer'
import { TextDecoder } from 'node:util'

export const SELF_IDENTITY_WIRE = 'WEAPP_JOURNAL_SELF_V1'
const epochTicks = 621355968000000000n
const maximumTicks = 3155378975999999999n

function invalid() {
  return new Error('Managed journal writer identity could not be verified; the journal remains unchanged.')
}

/** 保留 CIM 的微秒精度与七位小数格式；整数 ticks 不经浮点数或 Date 丢失尾数。 */
export function cimStartedFromTicks(value: string) {
  if (!/^[1-9]\d{0,18}$/.test(value)) {
    throw invalid()
  }
  const ticks = BigInt(value)
  if (ticks < epochTicks || ticks > maximumTicks) {
    throw invalid()
  }
  const seconds = (ticks - epochTicks) / 10_000_000n
  const prefix = new Date(Number(seconds * 1_000n)).toISOString().slice(0, 19)
  const fraction = ((ticks % 10_000_000n) / 10n * 10n).toString().padStart(7, '0')
  return `${prefix}.${fraction}Z`
}

function decodeExecutable(value: string) {
  const bytes = Buffer.from(value, 'base64')
  if (!value || bytes.toString('base64') !== value) {
    throw invalid()
  }
  const executable = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (!executable.trim() || !Buffer.from(executable).equals(bytes)
    || [...executable].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) {
    throw invalid()
  }
  return executable
}

/** 只接受一次完整自查结果；额外输出、退出或代次变化均不能授予写入身份。 */
export function parseWindowsSelfIdentity(stdout: string, expectedPid: number): ManagedWechatHostIdentity {
  if (!Number.isSafeInteger(expectedPid) || expectedPid <= 0 || !/^[\t\r\n\x20-\x7E]*$/.test(stdout)) {
    throw invalid()
  }
  const line = stdout.replace(/\r?\n$/, '')
  const fields = line.split('\t')
  const [marker, status, pid, before, after, exited, started, encodedExecutable] = fields
  if (fields.length !== 8 || marker !== SELF_IDENTITY_WIRE || status !== 'present'
    || pid !== String(expectedPid) || before !== after || exited !== 'false'
    || !before || !started || !encodedExecutable || started !== cimStartedFromTicks(before)) {
    throw invalid()
  }
  return { pid: expectedPid, executable: decodeExecutable(encodedExecutable), started }
}
