/// <reference types="miniprogram-api-typings" />

// eslint-disable-next-line antfu/no-import-dist
import type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiInstance,
  WeapiPromisify,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
} from '../dist/index.d.mts'

export type {
  CreateWeapiOptions,
  WeapiAdapter,
  WeapiInstance,
  WeapiPromisify,
  WeapiWxAdapter,
  WeapiWxRawAdapter,
}

export function createWeapi<TAdapter extends WeapiAdapter = WeapiWxRawAdapter>(
  options?: CreateWeapiOptions<TAdapter>,
): WeapiInstance<TAdapter>

export const wpi: WeapiInstance<WechatMiniprogram.Wx>
