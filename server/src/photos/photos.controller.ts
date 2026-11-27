import { Controller, Get, HttpCode, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { DayPipe } from '../common/day.pipe';
import { IdPipe } from '../common/id.pipe';
import { PhotosService } from './photos.service';
import { readPhotoBody } from './read-body';
import { BusyException } from './upload-gate';
import { DaySubmissionsView, SubmissionView } from './views';

@Controller()
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post('groups/:id/days/:day/submission')
  create(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Query('source') source: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SubmissionView> {
    return this.guarded(response, () =>
      this.photos.submit(auth.subject, id, day, { mode: 'create', source }, () => readPhotoBody(request)),
    );
  }

  @Put('groups/:id/days/:day/submission')
  @HttpCode(200)
  replace(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
    @Query('source') source: string | undefined,
    @Query('replaces') replaces: string | undefined,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SubmissionView> {
    return this.guarded(response, () =>
      this.photos.submit(auth.subject, id, day, { mode: 'replace', source, replaces }, () => readPhotoBody(request)),
    );
  }

  @Get('groups/:id/days/:day/submissions')
  list(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('day', new DayPipe()) day: number,
  ): Promise<DaySubmissionsView> {
    return this.photos.list(auth.subject, id, day);
  }

  private async guarded<T>(response: Response, work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof BusyException) {
        response.setHeader('Retry-After', '3');
      }
      throw error;
    }
  }
}
