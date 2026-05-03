import { defineConfig } from 'vitest/config'

/** Separate from `vite.config.ts` so `tsc -b` does not cross-wire Vitest’s nested Vite types with app plugins. */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
