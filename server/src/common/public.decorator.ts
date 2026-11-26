import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../shared/app_check';

/** Marks a route that needs neither a session nor an App Check token. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
