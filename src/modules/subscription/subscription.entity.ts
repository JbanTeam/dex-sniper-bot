import { IsEnum, IsEthereumAddress } from 'class-validator';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

import { User } from '../user/user.entity';
// import { UserToken } from '../user/user-token.entity';
import { Network } from '@src/types/types';

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsEthereumAddress()
  address: `0x${string}`;

  @Column({ enum: Network })
  @IsEnum(Network)
  network: Network;

  @Column({ default: 0 })
  buy: number;

  @Column({ default: 0 })
  sell: number;

  @ManyToOne(() => User, user => user.subscriptions, { onDelete: 'CASCADE' })
  user: User;

  // @ManyToOne(() => UserToken, token => token.subscriptions)
  // token: UserToken;
}
