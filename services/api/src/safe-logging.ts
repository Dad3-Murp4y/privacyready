type ErrorLike = {
  name?: unknown;
  code?: unknown;
  statusCode?: unknown;
  $metadata?: { httpStatusCode?: unknown; requestId?: unknown };
};

function safeString(value: unknown, maxLength = 80): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, maxLength) : undefined;
}

export function safeErrorMetadata(error: unknown): Record<string, string | number> {
  if (!error || typeof error !== 'object') return { errorType: typeof error };
  const candidate = error as ErrorLike;
  const metadata: Record<string, string | number> = {};
  const name = safeString(candidate.name);
  const code = safeString(candidate.code);
  const requestId = safeString(candidate.$metadata?.requestId);
  const status = candidate.statusCode ?? candidate.$metadata?.httpStatusCode;
  if (name) metadata.errorName = name;
  if (code) metadata.errorCode = code;
  if (typeof status === 'number') metadata.httpStatusCode = status;
  if (requestId) metadata.providerRequestId = requestId;
  return Object.keys(metadata).length > 0 ? metadata : { errorType: 'object' };
}

export function maskedEmail(email: string): string {
  const separator = email.lastIndexOf('@');
  if (separator <= 0) return '[invalid-email]';
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}
