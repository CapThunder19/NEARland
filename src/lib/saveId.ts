/** Save keys look like `near:<account-id>`. Reject anything else at the API boundary. */
export function isValidSaveId(value: unknown): value is string {
  return typeof value === 'string' && /^near:[a-z0-9._-]{2,64}$/.test(value);
}
