/** When `VITE_AI_CONVERSATIONAL_SEARCH=true`, submitting the main search (non-empty) calls `POST /api/listings/ai-search` and merges suggested filters into the URL. */
export function isAiConversationalSearchEnabled(): boolean {
  return import.meta.env.VITE_AI_CONVERSATIONAL_SEARCH === 'true'
}
