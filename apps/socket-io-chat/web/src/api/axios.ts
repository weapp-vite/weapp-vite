import type { ContactProfile } from './types'
import axios from 'axios'
import { apiBase } from './base'

export async function loadContactProfileWithAxios() {
  const response = await axios.get<ContactProfile>(`${apiBase}/api/contact`)
  return response.data
}
