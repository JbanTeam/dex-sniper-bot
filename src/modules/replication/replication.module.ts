import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Replication } from './replication.entity';
import { RedisModule } from '@modules/redis/redis.module';
import { ReplicationService } from './replication.service';

@Module({
  imports: [TypeOrmModule.forFeature([Replication]), RedisModule],
  providers: [ReplicationService],
  exports: [ReplicationService],
})
export class ReplicationModule {}
