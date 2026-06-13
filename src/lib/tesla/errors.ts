/** Tesla API error types and helpers (safe for client + server). */

export class TeslaApiError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = 'TeslaApiError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function isPartnerRegistrationError(message: string): boolean {
  return (
    message.includes('412') ||
    message.includes('must be registered in the current region') ||
    message.includes('Precondition Failed') ||
    message.includes('Unregistered account')
  );
}
