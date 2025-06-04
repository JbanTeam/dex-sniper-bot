import { IsEnum } from 'class-validator';
import { Column, Entity, ManyToOne } from 'typeorm';

import { Network } from '@src/types/types';
import { User } from '@modules/user/user.entity';
import { Subscription } from '@modules/subscription/subscription.entity';
import { UserToken } from '@modules/user-token/user-token.entity';
import { BaseEntity } from '@src/common/entities/base.entity';

@Entity()
export class Replication extends BaseEntity {
  @Column({ enum: Network, default: Network.BSC })
  @IsEnum(Network)
  network: Network;

  @Column({ default: 0 })
  buy: number;

  @Column({ default: 0 })
  sell: number;

  @ManyToOne(() => User, user => user.replications, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Subscription, sub => sub.replications, { onDelete: 'CASCADE' })
  subscription: Subscription;

  @ManyToOne(() => UserToken, token => token.replications, { onDelete: 'CASCADE' })
  token: UserToken;
}
