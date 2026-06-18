import { describe, expect, it } from 'vitest';
import { ErrorCode, PdfError } from '../src/utils/errors.js';

describe('ErrorCode', () => {
  it('maps to the JSON-RPC reserved error numbers', () => {
    expect(ErrorCode.InvalidParams).toBe(-32602);
    expect(ErrorCode.InvalidRequest).toBe(-32600);
    expect(ErrorCode.MethodNotFound).toBe(-32601);
  });
});

describe('PdfError', () => {
  it('is an Error with a stable name and the carried code/message', () => {
    const err = new PdfError(ErrorCode.InvalidParams, 'bad page range');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(PdfError);
    expect(err.name).toBe('PdfError');
    expect(err.code).toBe(ErrorCode.InvalidParams);
    expect(err.message).toBe('bad page range');
  });

  it('leaves cause unset when no options are passed', () => {
    const err = new PdfError(ErrorCode.InvalidRequest, 'access denied');

    expect(err.cause).toBeUndefined();
  });

  it('leaves cause unset when options omit a cause', () => {
    const err = new PdfError(ErrorCode.InvalidRequest, 'access denied', {});

    expect(err.cause).toBeUndefined();
  });

  it('attaches the underlying cause when one is provided', () => {
    const underlying = new Error('ENOENT: no such file');
    const err = new PdfError(ErrorCode.MethodNotFound, 'failed to load', {
      cause: underlying,
    });

    expect(err.cause).toBe(underlying);
    expect(err.message).toBe('failed to load');
    expect(err.code).toBe(ErrorCode.MethodNotFound);
  });

  it('treats an explicit undefined cause the same as no cause', () => {
    const err = new PdfError(ErrorCode.InvalidParams, 'oops', { cause: undefined });

    expect(err.cause).toBeUndefined();
  });

  it('is catchable as a PdfError after being thrown', () => {
    const throwIt = (): never => {
      throw new PdfError(ErrorCode.InvalidParams, 'invalid');
    };

    expect(throwIt).toThrow(PdfError);
    expect(throwIt).toThrow('invalid');
  });
});
