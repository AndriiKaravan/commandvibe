import { BadRequestException, Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { SessionSubject } from '../data/models';
import { CurrentAuth } from './current-subject.decorator';
import { IssuedTokens, SessionService, VerifiedAccess } from './session.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly sessions: SessionService) {}

  @Public()
  @Post('refresh')
  refresh(@Body() body: { refreshToken?: unknown }): Promise<IssuedTokens> {
    if (typeof body?.refreshToken !== 'string') {
      throw new BadRequestException('refresh_token_missing');
    }
    return this.sessions.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentAuth() auth: VerifiedAccess): Promise<void> {
    await this.sessions.revoke(auth.sessionId);
  }

  @Get('me')
  me(@CurrentAuth() auth: VerifiedAccess): SessionSubject {
    return auth.subject;
  }
}
