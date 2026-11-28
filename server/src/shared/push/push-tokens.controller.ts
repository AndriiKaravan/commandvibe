// generated from ks_server/push — do not edit; run: npm run sync:push
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
  Req,
  Type,
  UnauthorizedException,
} from '@nestjs/common';
import { MAX_PUSH_TOKEN_LENGTH, PUSH_PLATFORMS } from './push.types';
import type { PushOptions, PushPlatform } from './push.types';
import { PUSH_OPTIONS } from './push.tokens';
import { PushService } from './push.service';

function tokenFrom(body: unknown): string {
  const token = (body as { token?: unknown } | null)?.token;
  if (Array.isArray(body) || typeof token !== 'string' || token.length === 0 || token.length > MAX_PUSH_TOKEN_LENGTH) {
    throw new BadRequestException(`token must be a string of 1..${MAX_PUSH_TOKEN_LENGTH} characters`);
  }
  return token;
}

function platformFrom(body: unknown): PushPlatform {
  const platform = (body as { platform?: unknown }).platform;
  if (!PUSH_PLATFORMS.includes(platform as PushPlatform)) {
    throw new BadRequestException(`platform must be one of ${PUSH_PLATFORMS.join(', ')}`);
  }
  return platform as PushPlatform;
}

/**
 * This device's FCM token: PUT after sign-in and on every token refresh,
 * DELETE before sign-out. The account always comes from the request's
 * session (`userIdOf`), never from the body.
 */
export function createPushTokensController(path: string): Type<unknown> {
  @Controller(path)
  class PushTokensController {
    constructor(
      @Inject(PUSH_OPTIONS) private readonly options: PushOptions,
      @Inject(PushService) private readonly push: PushService,
    ) {}

    private async userIdOf(request: unknown): Promise<string> {
      let userId: string | null | undefined;
      try {
        userId = await this.options.userIdOf(request);
      } catch {
        userId = undefined;
      }
      if (!userId) throw new UnauthorizedException();
      return userId;
    }

    @Put()
    @HttpCode(HttpStatus.NO_CONTENT)
    async register(@Req() request: unknown, @Body() body: unknown): Promise<void> {
      const userId = await this.userIdOf(request);
      await this.push.registerToken(userId, tokenFrom(body), platformFrom(body));
    }

    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Req() request: unknown, @Body() body: unknown): Promise<void> {
      const userId = await this.userIdOf(request);
      await this.push.removeToken(userId, tokenFrom(body));
    }
  }
  return PushTokensController;
}
