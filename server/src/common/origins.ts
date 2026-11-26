/** Browser origins allowed for REST (CORS) and WebSocket; from `ALLOWED_ORIGINS`, comma-separated. */
export function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
