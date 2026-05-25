import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  client: '@hey-api/client-fetch',
  input: 'http://localhost:8080/api/docs.json',
  output: {
    path: 'src/api/generated',
    format: 'prettier',
  },
})
