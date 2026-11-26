import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { IssuedTokens } from '../auth/session.service';
import { Public } from '../common/public.decorator';
import { InvitePreview, MemberView, MembersService } from './members.service';

@Controller('join')
export class JoinController {
  constructor(private readonly members: MembersService) {}

  @Public()
  @Get(':token')
  preview(@Param('token') token: string): Promise<InvitePreview> {
    return this.members.preview(token);
  }

  @Public()
  @Post()
  join(
    @Body() body: { token?: string; displayName?: string; department?: string },
    @Headers('user-agent') userAgent = '',
  ): Promise<IssuedTokens & { member: MemberView }> {
    return this.members.join(body?.token ?? '', body?.displayName ?? '', body?.department, userAgent);
  }

  @Public()
  @Post('returning')
  returning(
    @Body() body: { token?: string; displayName?: string; pin?: string },
    @Headers('user-agent') userAgent = '',
  ): Promise<IssuedTokens & { member: MemberView }> {
    return this.members.returning(body?.token ?? '', body?.displayName ?? '', body?.pin ?? '', userAgent);
  }
}
