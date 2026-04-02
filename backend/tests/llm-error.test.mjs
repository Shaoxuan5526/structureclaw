import { describe, expect, test } from '@jest/globals';
import { isLlmTimeoutError, toLlmApiError } from '../dist/utils/llm-error.js';

describe('LLM error mapping', () => {
  test('should classify timeout errors and map to 504', () => {
    const error = Object.assign(new Error('Request timed out.'), { name: 'TimeoutError' });
    expect(isLlmTimeoutError(error)).toBe(true);

    const mapped = toLlmApiError(error);
    expect(mapped.statusCode).toBe(504);
    expect(mapped.body.error.code).toBe('LLM_TIMEOUT');
    expect(mapped.body.error.retriable).toBe(true);
  });

  test('should map unknown errors to 500 internal error', () => {
    const error = new Error('database disconnected');
    expect(isLlmTimeoutError(error)).toBe(false);

    const mapped = toLlmApiError(error);
    expect(mapped.statusCode).toBe(500);
    expect(mapped.body.error.code).toBe('INTERNAL_ERROR');
    expect(mapped.body.error.retriable).toBe(false);
  });

  test('should classify timeout-like string errors', () => {
    expect(isLlmTimeoutError('ETIMEDOUT during request')).toBe(true);
    expect(isLlmTimeoutError('operation aborted by timeout')).toBe(true);
  });
});
