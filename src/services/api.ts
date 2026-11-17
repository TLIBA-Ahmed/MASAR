/** Same-origin API only. Identity and authority are resolved by the server. */
let csrf = '';
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export async function api<T>(path: string, body?: unknown, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'same-origin',
    method: options.method ?? (body === undefined ? 'GET' : 'POST'),
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Masar-CSRF': csrf }),
      ...options.headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    const detail = (value as { detail?: { code?: string } | string }).detail;
    throw new ApiError(
      response.status,
      typeof detail === 'object' ? (detail?.code ?? 'API_REFUSED') : (detail ?? 'API_REFUSED'),
    );
  }
  if (value && typeof value === 'object' && 'csrf_token' in value) csrf = String(value.csrf_token);
  return value as T;
}
export function csrfHeader() {
  return csrf;
}
