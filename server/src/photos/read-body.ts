import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import type { Request } from 'express';

export const maxPhotoBytes = 20 * 1024 * 1024;

function tooLarge(request: Request): PayloadTooLargeException {
  // The rest of an oversized body is never read, so the connection must not be reused.
  request.res?.setHeader('Connection', 'close');
  return new PayloadTooLargeException('photo_too_large');
}

/** Reads a raw image body, refusing past [max] bytes both by `Content-Length` and by what actually arrives. */
export function readPhotoBody(request: Request, max = maxPhotoBytes): Promise<Buffer> {
  const type = (request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/') && type !== 'application/octet-stream') {
    throw new UnsupportedMediaTypeException('unsupported_type');
  }
  const declared = Number(request.headers['content-length']);
  if (Number.isFinite(declared) && declared > max) {
    throw tooLarge(request);
  }
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const cleanup = () => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('close', onClose);
    };
    const onData = (chunk: Buffer) => {
      total += chunk.length;
      if (total > max) {
        cleanup();
        request.pause();
        reject(tooLarge(request));
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = () => {
      cleanup();
      reject(new BadRequestException('upload_failed'));
    };
    const onClose = () => {
      if (!request.complete) {
        cleanup();
        reject(new BadRequestException('upload_aborted'));
      }
    };
    request.on('data', onData);
    request.on('end', onEnd);
    request.on('error', onError);
    request.on('close', onClose);
  });
}
