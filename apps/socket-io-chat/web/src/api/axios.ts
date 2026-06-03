import axios from 'axios'
import { apiBase } from './base'
import type { ContactProfile } from './types'

export async function loadContactProfileWithAxios() {
  const response = await axios.get<ContactProfile>(`${apiBase}/api/contact`)
  return response.data
}
