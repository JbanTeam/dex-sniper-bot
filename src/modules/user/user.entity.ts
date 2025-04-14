import { IsNumber, ValidateNested } from 'class-validator';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';

import { UserToken } from './user-token.entity';
import { Wallet } from '@modules/wallet/wallet.entity';
import { Subscription } from '@modules/subscription/subscription.entity';
import { Replication } from '@modules/subscription/replication.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, type: 'bigint' })
  @IsNumber()
  chatId: number;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => UserToken, token => token.user, { cascade: true })
  @ValidateNested({ each: true })
  tokens: UserToken[];

  @OneToMany(() => Subscription, subscription => subscription.user, { cascade: true })
  @ValidateNested({ each: true })
  subscriptions: Subscription[];

  @OneToMany(() => Wallet, wallet => wallet.user, { cascade: true })
  @ValidateNested({ each: true })
  wallets: Wallet[];

  @OneToMany(() => Replication, replication => replication.user, { cascade: true })
  @ValidateNested({ each: true })
  replications: Replication[];
}
