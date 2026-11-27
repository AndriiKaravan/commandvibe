import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/public.decorator';
import { PhotosService } from './photos.service';

/** Serves photo bytes behind short signed links; every refusal is the same bare 404. */
@Controller()
export class PhotoFileController {
  constructor(private readonly photos: PhotosService) {}

  // Public for the session and App Check guards: the signed link is the credential, and access is re-checked here.
  @Public()
  @Get('p/:token')
  async file(@Param('token') token: string, @Res() response: Response): Promise<void> {
    const file = await this.photos.fileFor(token).catch(() => undefined);
    if (!file) {
      response.status(404).end();
      return;
    }
    response
      .status(200)
      .set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': `private, max-age=${file.maxAgeSeconds}`,
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(file.bytes);
  }
}
