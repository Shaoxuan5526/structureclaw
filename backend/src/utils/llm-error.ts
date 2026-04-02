export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    retriable: boolean;
  };
}

const LLM_TIMEOUT_PATTERNS = [
  'request timed out',
  'timeout',
  'timed out',
  'etimedout',
  'aborterror',
];

function errorToText(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }
  return String(error).toLowerCase();
}

export function isLlmTimeoutError(error: unknown): boolean {
  const text = errorToText(error);
  return LLM_TIMEOUT_PATTERNS.some((pattern) => text.includes(pattern));
}

export function toLlmApiError(error: unknown): { statusCode: number; body: ApiErrorBody } {
  if (isLlmTimeoutError(error)) {
    return {
      statusCode: 504,
      body: {
        error: {
          code: 'LLM_TIMEOUT',
          message: 'LLM request timed out. Please retry later.',
          retriable: true,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error.',
        retriable: false,
      },
    },
  };
}
