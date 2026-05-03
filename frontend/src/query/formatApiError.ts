import { ApiError } from '../api/client'

export function formatApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}${error.body ? ` — ${error.body.slice(0, 200)}` : ''}`
  }
  return 'Unexpected error'
}
