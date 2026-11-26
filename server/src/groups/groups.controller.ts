import { IdPipe } from '../common/id.pipe';
import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentAuth } from '../auth/current-subject.decorator';
import { VerifiedAccess } from '../auth/session.service';
import { Group } from '../data/models';
import { CreateGroupInput, GroupsService } from './groups.service';

/** What clients see of a group: never the invite hash. */
export type GroupView = Omit<Group, 'inviteTokenHash'>;

export function groupView(group: Group): GroupView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inviteTokenHash, ...view } = group;
  return view;
}

function organizerUid(auth: VerifiedAccess): string {
  if (auth.subject.kind !== 'organizer') {
    throw new ForbiddenException('organizer_only');
  }
  return auth.subject.id;
}

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  async create(@CurrentAuth() auth: VerifiedAccess, @Body() body: CreateGroupInput): Promise<{ group: GroupView; inviteUrl: string }> {
    const { group, inviteUrl } = await this.groups.create(organizerUid(auth), body ?? ({} as CreateGroupInput));
    return { group: groupView(group), inviteUrl };
  }

  @Get(':id')
  async get(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<GroupView> {
    return groupView(await this.groups.getFor(auth.subject, id));
  }

  @Post(':id/invite/rotate')
  async rotate(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<{ inviteUrl: string }> {
    const { inviteUrl } = await this.groups.rotateInvite(organizerUid(auth), id);
    return { inviteUrl };
  }

  @Post(':id/invite/close')
  @HttpCode(204)
  async close(@CurrentAuth() auth: VerifiedAccess, @Param('id', IdPipe) id: string): Promise<void> {
    await this.groups.closeInvite(organizerUid(auth), id);
  }
}
