import { RequestTimeoutException } from '@nestjs/common';
import type { Request } from 'express';
import { PassThrough } from 'node:stream';
import { readPhotoBody } from './read-body';

function requestOf(stream: PassThrough): Request {
  return Object.assign(stream, {
    headers: { 'content-type': 'image/jpeg' },
    complete: false,
    res: undefined,
  }) as unknown as Request;
}

describe('readPhotoBody', () => {
  it('should give up on a sender that stops sending', async () => {
    const stream = new PassThrough();
    const pending = readPhotoBody(requestOf(stream), 1024, 30);
    stream.write(Buffer.from('partial'));
    await expect(pending).rejects.toBeInstanceOf(RequestTimeoutException);
  });

  it('should keep waiting while data keeps arriving', async () => {
    const stream = new PassThrough();
    const pending = readPhotoBody(requestOf(stream), 1024, 80);
    for (const part of ['a', 'b', 'c']) {
      stream.write(part);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    stream.end();
    await expect(pending).resolves.toEqual(Buffer.from('abc'));
  });
});
