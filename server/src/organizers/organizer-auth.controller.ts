import { BadRequestException, Body, Controller, ForbiddenException, Headers, Inject, Post } from '@nestjs/common';
import { CLOCK, IssuedTokens, SessionService } from '../auth/session.service';
import { Public } from '../common/public.decorator';
import { ORGANIZERS, OrganizerRepository } from '../data/repositories';
import { FirebaseService } from '../firebase/firebase.service';

// Google now; email link signs in as `password` (design 6). Apple comes with the stores.
const allowedProviders = new Set(['google.com', 'password', 'emailLink']);

@Controller('auth')
export class OrganizerAuthController {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly sessions: SessionService,
    @Inject(ORGANIZERS) private readonly organizers: OrganizerRepository,
    @Inject(CLOCK) private readonly now: () => Date,
  ) {}

  @Public()
  @Post('organizer')
  async signIn(
    @Body() body: { idToken?: unknown },
    @Headers('user-agent') userAgent = '',
  ): Promise<IssuedTokens & { organizer: { uid: string; email: string } }> {
    if (typeof body?.idToken !== 'string') {
      throw new BadRequestException('id_token_missing');
    }
    const user = await this.firebase.verifyIdToken(body.idToken);
    if (!allowedProviders.has(user.provider) || !user.email) {
      throw new ForbiddenException('provider_not_allowed');
    }
    const existing = await this.organizers.get(user.uid);
    await this.organizers.upsert({
      uid: user.uid,
      email: user.email,
      displayName: user.name ?? existing?.displayName,
      createdAt: existing?.createdAt ?? this.now(),
    });
    const tokens = await this.sessions.issue({ kind: 'organizer', id: user.uid }, userAgent);
    return { ...tokens, organizer: { uid: user.uid, email: user.email } };
  }
}
