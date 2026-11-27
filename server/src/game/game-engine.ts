import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Cell, CellState, Group, GameSettings, RouletteSpin, SessionSubject } from '../data/models';
import { CELLS, CellRepository, GROUPS, GroupRepository, MEMBERS, MemberRepository } from '../data/repositories';
import { GroupsService } from '../groups/groups.service';
import { GameEvents } from './game-events';
import { GAME_EVENTS, RANDOM } from './game.tokens';
import { pickPicker, spinDoors } from './roulette';
import { Random } from './task-picker';
import { TodayView, dayView, spinView, taskVisibleToPlayers } from './views';

const pickWindowMs = 3 * 60 * 60 * 1000;
const spinLeadMs = 1500;
const spinDurationMs = 5000;
const finishAfterMs = 24 * 60 * 60 * 1000;

/**
 * Moves the game forward: opens days on schedule and runs the roulette.
 * Every step is a compare-and-set on the cell, so overlapping callers (Scheduler, readers,
 * a member's spin) can never open a day or publish an event twice.
 */
@Injectable()
export class GameEngine {
  constructor(
    private readonly groupsService: GroupsService,
    @Inject(GROUPS) private readonly groups: GroupRepository,
    @Inject(CELLS) private readonly cells: CellRepository,
    @Inject(MEMBERS) private readonly members: MemberRepository,
    @Inject(GAME_EVENTS) private readonly events: GameEvents,
    @Inject(RANDOM) private readonly random: Random,
  ) {}

  /** Idempotent: brings the cells of one group up to [now]. */
  async advance(groupId: string, now: Date): Promise<void> {
    const group = await this.groups.get(groupId);
    if (!group?.game || group.status === 'finished') {
      return;
    }
    const cells = await this.cells.list(groupId);
    const due = cells.filter((cell) => cell.opensAt.getTime() <= now.getTime());
    const latest = due[due.length - 1];
    for (const cell of due) {
      if (cell.state === 'open') {
        continue;
      }
      if (group.game.mode === 'auto') {
        await this.open(group, cell, now);
      } else if (cell.dayIndex !== latest.dayIndex) {
        // A missed day: nobody can pick for it any more, so the game opens it.
        await this.performSpin(group, cell, cell.state, 'game', now);
      } else if (cell.state === 'closed') {
        await this.startPicking(group, cells, cell, now);
      } else if (cell.pickDeadlineAt && cell.pickDeadlineAt.getTime() <= now.getTime()) {
        await this.performSpin(group, cell, 'picking', 'game', now);
      }
    }
    await this.finishIfOver(group, group.game, now);
  }

  /** The chosen member spins today's roulette. */
  async spin(subject: SessionSubject, groupId: string, now: Date): Promise<void> {
    const group = await this.groupsService.getFor(subject, groupId);
    const memberId = await this.memberIdOf(subject, groupId);
    const picking = (await this.cells.list(groupId)).find((cell) => cell.state === 'picking');
    if (!picking) {
      throw new ConflictException('not_picking');
    }
    if (!memberId || picking.pickerMemberId !== memberId) {
      throw new ForbiddenException('not_your_turn');
    }
    if (picking.pickDeadlineAt && picking.pickDeadlineAt.getTime() <= now.getTime()) {
      throw new ConflictException('deadline_passed');
    }
    if (!(await this.performSpin(group, picking, 'picking', 'member', now))) {
      throw new ConflictException('not_picking');
    }
  }

  /** The "Today" screen: the current day, who has to spin and the running animation. */
  async today(subject: SessionSubject, groupId: string, now: Date): Promise<TodayView> {
    await this.groupsService.getFor(subject, groupId);
    await this.advance(groupId, now);
    const group = await this.groups.get(groupId);
    const serverTime = now.toISOString();
    const game = group?.game;
    if (!group || !game) {
      return { status: 'not_configured', serverTime };
    }
    const isOrganizer = subject.kind === 'organizer';
    const cells = await this.cells.list(groupId);
    const due = cells.filter((cell) => cell.opensAt.getTime() <= now.getTime());
    if (due.length === 0) {
      const first = cells[0];
      return { status: 'before_start', game, day: first && dayView(first, game, isOrganizer), serverTime };
    }
    const current = due[due.length - 1];
    const day = {
      ...dayView(current, game, isOrganizer || taskVisibleToPlayers(current, now)),
      ...(current.pickerMemberId ? { pickerMemberId: current.pickerMemberId } : {}),
      ...(current.pickDeadlineAt ? { pickDeadlineAt: current.pickDeadlineAt.toISOString() } : {}),
      ...(current.state === 'picking'
        ? { isMyTurn: current.pickerMemberId === (await this.memberIdOf(subject, groupId)) }
        : {}),
      ...(current.spin ? { spin: spinView(current.spin) } : {}),
    };
    return { status: group.status === 'finished' ? 'finished' : 'active', game, day, serverTime };
  }

  private async open(group: Group, cell: Cell, now: Date): Promise<void> {
    if (await this.cells.transition(group.id, cell.dayIndex, 'closed', { state: 'open', openedAt: now })) {
      await this.activate(group.id);
      this.events.publish(group.id, 'day.opened', { dayIndex: cell.dayIndex });
    }
  }

  private async startPicking(group: Group, cells: Cell[], cell: Cell, now: Date): Promise<void> {
    const active = (await this.members.list(group.id)).filter((member) => member.status === 'active');
    const pickerMemberId = pickPicker(
      active.map((member) => member.id),
      cells,
      this.random,
    );
    if (!pickerMemberId) {
      await this.performSpin(group, cell, 'closed', 'game', now);
      return;
    }
    const pickDeadlineAt = new Date(now.getTime() + pickWindowMs);
    if (
      await this.cells.transition(group.id, cell.dayIndex, 'closed', {
        state: 'picking',
        pickerMemberId,
        pickDeadlineAt,
      })
    ) {
      this.events.publish(group.id, 'roulette.waiting', {
        dayIndex: cell.dayIndex,
        pickerMemberId,
        deadlineAt: pickDeadlineAt.toISOString(),
      });
    }
  }

  /**
   * Opens [cell] through the wheel. The wheel carries day numbers only; the task behind the winning
   * door becomes today's task and today's old task goes to that door. True only for the winning caller.
   */
  private async performSpin(
    group: Group,
    cell: Cell,
    expected: CellState,
    by: RouletteSpin['by'],
    now: Date,
  ): Promise<boolean> {
    const cells = await this.cells.list(group.id);
    const current = cells.find((item) => item.dayIndex === cell.dayIndex);
    if (!current) {
      return false;
    }
    const closedDays = cells
      .filter((item) => item.dayIndex >= cell.dayIndex && item.state !== 'open')
      .map((item) => item.dayIndex);
    const { doors, winnerIndex } = spinDoors(closedDays, this.random);
    const winnerDay = doors[winnerIndex];
    const winner = cells.find((item) => item.dayIndex === winnerDay);
    if (!winner) {
      return false;
    }
    const spin: RouletteSpin = {
      startAt: new Date(now.getTime() + spinLeadMs),
      durationMs: spinDurationMs,
      doors,
      winnerIndex,
      by,
    };
    const won = await this.cells.transition(group.id, cell.dayIndex, expected, {
      state: 'open',
      openedAt: now,
      spin,
      task: winner.task,
    });
    if (!won) {
      return false;
    }
    if (winnerDay !== cell.dayIndex) {
      await this.cells.transition(group.id, winnerDay, 'closed', { task: current.task });
    }
    await this.activate(group.id);
    this.events.publish(group.id, 'roulette.spin', {
      dayIndex: cell.dayIndex,
      doors,
      winnerIndex,
      startAt: spin.startAt.toISOString(),
      durationMs: spin.durationMs,
      serverTime: now.toISOString(),
      by,
    });
    this.events.publish(group.id, 'day.opened', { dayIndex: cell.dayIndex });
    return true;
  }

  private async activate(groupId: string): Promise<void> {
    await this.groups.setStatus(groupId, 'draft', 'active');
  }

  private async finishIfOver(group: Group, game: GameSettings, now: Date): Promise<void> {
    const last = await this.cells.get(group.id, game.days - 1);
    if (last?.state !== 'open' || now.getTime() < last.opensAt.getTime() + finishAfterMs) {
      return;
    }
    if (await this.groups.setStatus(group.id, 'active', 'finished')) {
      this.events.publish(group.id, 'game.finished', {});
    }
  }

  /** The member record that plays for this session: a member, or an organizer who plays too. */
  private async memberIdOf(subject: SessionSubject, groupId: string): Promise<string | undefined> {
    if (subject.kind === 'member') {
      return subject.id;
    }
    const members = await this.members.list(groupId);
    return members.find((member) => member.organizerUid === subject.id && member.status === 'active')?.id;
  }
}
