/**
 * Allowed Otodom listing tag ids (search + AI). Keep in sync with
 * `backend/src/infrastructure/ai/otodomTagging.ts` → `OTODOM_LISTING_TAG_IDS`.
 */
export const OTODOM_LISTING_TAG_IDS = [
  'budget',
  'mid_range',
  'premium',
  'small',
  'medium',
  'large',
  'very_large',
  'new_build',
  'resale',
  'developer_offer',
  'private_offer',
  'garage',
  'parking',
  'garden',
  'near_transport',
  'quiet_area',
  'near_forest',
  'family_friendly',
  'modern',
  'needs_finishing',
  'needs_renovation',
  'good_commute',
  'city_center',
  'suburban',
  'fenced_area',
] as const

export type OtodomListingTagId = (typeof OTODOM_LISTING_TAG_IDS)[number]
