import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { AuthenticatedRequest } from './auth.guard';
import { VerifiedAccess } from './session.service';

/** The verified session of the request; only on routes behind [AuthGuard]. */
export const CurrentAuth = createParamDecorator((_: unknown, context: ExecutionContext): VerifiedAccess => {
  const auth = context.switchToHttp().getRequest<AuthenticatedRequest>().auth;
  if (!auth) {
    throw new Error('CurrentAuth used on a public route');
  }
  return auth;
});
