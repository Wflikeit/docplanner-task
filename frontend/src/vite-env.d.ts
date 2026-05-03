/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** `"true"` enables the AI search panel (from `.env`; restart Vite). */
  readonly VITE_AI_CONVERSATIONAL_SEARCH?: string
}
