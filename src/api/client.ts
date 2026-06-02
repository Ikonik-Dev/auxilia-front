import { createClient, createConfig } from '@hey-api/client-fetch'

export const apiClient = createClient(
  createConfig({
    baseUrl: '/api',
    credentials: 'include',
  }),
)

apiClient.interceptors.response.use(async (response) => {
  if (response.status === 401) {
    // Cookie expiré — laisser le router guard gérer la redirection
  }
  return response
})
