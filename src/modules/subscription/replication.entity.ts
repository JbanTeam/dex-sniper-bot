import { IsEnum } from 'class-validator';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Subscription } from './subscription.entity';
import { Network } from '@src/types/types';
import { User } from '@modules/user/user.entity';
import { UserToken } from '@modules/user-token/user-token.entity';

@Entity()
export class Replication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ enum: Network, default: Network.BSC })
  @IsEnum(Network)
  network: Network;

  @Column({ default: 0 })
  buy: number;

  @Column({ default: 0 })
  sell: number;

  @ManyToOne(() => User, user => user.replications, { onDelete: 'CASCADE' })
  user: Subscription;

  @ManyToOne(() => Subscription, sub => sub.replications, { onDelete: 'CASCADE' })
  subscription: Subscription;

  @ManyToOne(() => UserToken, token => token.replications, { onDelete: 'CASCADE' })
  token: UserToken;
}
