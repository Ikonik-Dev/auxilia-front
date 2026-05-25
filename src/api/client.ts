import { createClient, createConfig } from '@hey-api/client-fetch'

const TOKEN_KEY = 'auxilia_jwt'

export const apiClient = createClient(
  createConfig({
    baseUrl: '/api',
  }),
)

apiClient.interceptors.request.use((request) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`)
  }
  return request
})

apiClient.interceptors.response.use(async (response) => {
  if (response.status === 401) {
    // Token expiré — laisser le router guard gérer la redirection
    localStorage.removeItem(TOKEN_KEY)
  }
  return response
})
