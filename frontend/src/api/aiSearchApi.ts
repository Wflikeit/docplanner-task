import { apiPostJson } from './client'
import type {
  AiListingSearchRequest,
  AiListingSearchResponse,
} from './aiSearchTypes'

export async function postAiListingSearch(
  payload: AiListingSearchRequest,
  signal?: AbortSignal,
): Promise<AiListingSearchResponse> {
  return apiPostJson<AiListingSearchResponse>(
    '/api/listings/ai-search',
    payload,
    { signal },
  )
}
