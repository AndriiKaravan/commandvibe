import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { IdPipe } from '../common/id.pipe';
import { FeedPage, FeedService } from './feed.service';

function toInt(raw: string | undefined): number | undefined {
  return raw === undefined || raw === '' ? undefined : Number(raw);
}

@Controller()
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get('groups/:id/feed')
  async page(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Query('day') day?: string,
    @Query('memberId') memberId?: string,
    @Query('mine') mine?: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ): Promise<FeedPage & { serverTime: string }> {
    const page = await this.feed.page(auth.subject, id, {
      day: toInt(day),
      memberId,
      mine: mine === '1' || mine === 'true',
      limit: toInt(limit),
      before,
    });
    return { ...page, serverTime: new Date().toISOString() };
  }
}
