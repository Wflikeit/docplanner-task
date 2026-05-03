export class ApiError extends Error {
  readonly status: number
  readonly body: string | undefined

  constructor(message: string, status: number, body?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

function joinBase(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? ''
  if (!base) return path
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  const res = await fetch(joinBase(path), {
    cache: 'no-store',
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  })

  const text = await res.text()
  if (!res.ok) {
    throw new ApiError(
      `Request failed (${res.status})`,
      res.status,
      text || undefined,
    )
  }

  if (!text) {
    return undefined as T
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new ApiError('Invalid JSON response', res.status, text)
  }
}

export async function apiPostJson<T>(
  path: string,
  body: unknown,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<T> {
  return apiJson<T>(path, {
    ...init,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
  })
}
