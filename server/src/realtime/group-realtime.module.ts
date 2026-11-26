import { Module } from '@nestjs/common';
import { allowedOrigins } from '../common/origins';
import { RealtimeModule } from '../shared/realtime';
import { RealtimeAccess, RealtimeMemberEvents } from './realtime-access';

@Module({
  providers: [RealtimeAccess],
  exports: [RealtimeAccess],
})
class RealtimeAccessModule {}

/** ks_server realtime wired to sessions and group membership. */
@Module({
  imports: [
    RealtimeAccessModule,
    RealtimeModule.forRootAsync({
      imports: [RealtimeAccessModule],
      inject: [RealtimeAccess],
      useFactory: (access: RealtimeAccess) => access.options(allowedOrigins()),
    }),
  ],
  providers: [RealtimeMemberEvents],
  exports: [RealtimeMemberEvents],
})
export class GroupRealtimeModule {}
