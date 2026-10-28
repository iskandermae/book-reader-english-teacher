/**
 * The single place where a failed call becomes a user message: logs the real error to the console and returns
 * the text to show. The server's readable `detail` wins over the fallback. The generated client throws the parsed
 * problem details (a plain object), not an Error, so both shapes are read.
 */
export function reportError(fallback: string, error: unknown): string {
  console.error(fallback, error);
  const detail = (error as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string' && detail) return detail;
  return error instanceof Error && error.message ? error.message : fallback;
}
