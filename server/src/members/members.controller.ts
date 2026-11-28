import { IdPipe } from '../common/id.pipe';
import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { GroupsService } from '../groups/groups.service';
import { MemberView, MembersService, memberView } from './members.service';

function memberSubject(auth: VerifiedAccess): { id: string; groupId: string } {
  if (auth.subject.kind !== 'member' || !auth.subject.groupId) {
    throw new ForbiddenException('member_only');
  }
  return { id: auth.subject.id, groupId: auth.subject.groupId };
}

function organizerUid(auth: VerifiedAccess): string {
  if (auth.subject.kind !== 'organizer') {
    throw new ForbiddenException('organizer_only');
  }
  return auth.subject.id;
}

@Controller()
export class MembersController {
  constructor(
    private readonly members: MembersService,
    private readonly groups: GroupsService,
  ) {}

  @Get('me')
  async me(@CurrentAuth() auth: VerifiedAccess): Promise<MemberView> {
    const subject = memberSubject(auth);
    return memberView(await this.members.member(subject.groupId, subject.id));
  }

  @Put('me/pin')
  @HttpCode(204)
  async setPin(@CurrentAuth() auth: VerifiedAccess, @Body() body: { pin?: string }): Promise<void> {
    await this.members.setPin(memberSubject(auth), body?.pin ?? '');
  }

  /** Owner sees pending members too; active members see active ones. */
  @Get('groups/:id/members')
  async list(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) groupId: string): Promise<MemberView[]> {
    const group = await this.groups.getFor(auth.subject, groupId);
    const isOwner = auth.subject.kind === 'organizer' && auth.subject.id === group.ownerUid;
    const all = await this.members.list(groupId);
    return all.filter((m) => m.status === 'active' || (isOwner && m.status === 'pending')).map(memberView);
  }

  @Put('groups/:id/me/avatar')
  @HttpCode(204)
  async setAvatar(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Body() body: { avatar?: unknown },
  ): Promise<void> {
    await this.members.setAvatar(auth.subject, id, body?.avatar ?? null);
  }

  @Post('groups/:id/members/:memberId/approve')
  @HttpCode(204)
  approve(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('memberId', IdPipe) memberId: string,
  ) {
    return this.members.approve(organizerUid(auth), id, memberId);
  }

  @Post('groups/:id/members/:memberId/remove')
  @HttpCode(204)
  remove(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('memberId', IdPipe) memberId: string,
  ) {
    return this.members.remove(organizerUid(auth), id, memberId);
  }

  @Post('groups/:id/members/:memberId/reset-pin')
  @HttpCode(204)
  resetPin(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('memberId', IdPipe) memberId: string,
  ) {
    return this.members.resetPin(organizerUid(auth), id, memberId);
  }

  @Patch('groups/:id/members/:memberId/name')
  @HttpCode(204)
  rename(
    @CurrentAuth() auth: VerifiedAccess,
    @Param('id', IdPipe) id: string,
    @Param('memberId', IdPipe) memberId: string,
    @Body() body: { displayName?: string },
  ) {
    return this.members.rename(organizerUid(auth), id, memberId, body?.displayName ?? '');
  }
}
