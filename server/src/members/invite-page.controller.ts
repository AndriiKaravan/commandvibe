import { Controller, Get, GoneException, Inject, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../common/public.decorator';
import { PUBLIC_APP_URL } from '../groups/groups.service';
import { invitePageHtml } from './invite-page.html';
import { MembersService } from './members.service';

/** `/j/<token>` (design 2а п. 12): Hosting rewrites it here. */
@Controller('j')
export class InvitePageController {
  constructor(
    private readonly members: MembersService,
    @Inject(PUBLIC_APP_URL) private readonly appUrl: string,
  ) {}

  @Public()
  @Get(':token')
  async page(@Param('token') token: string, @Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const preview = await this.members.preview(token);
      res
        .status(200)
        .send(
          invitePageHtml({
            appUrl: this.appUrl,
            token,
            group: { name: preview.groupName, memberCount: preview.memberCount },
          }),
        );
    } catch (error) {
      if (!(error instanceof GoneException)) {
        throw error;
      }
      res.status(410).send(invitePageHtml({ appUrl: this.appUrl, token }));
    }
  }
}
