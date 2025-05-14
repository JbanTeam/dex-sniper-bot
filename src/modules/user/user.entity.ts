import { IsNumber, ValidateNested } from 'class-validator';
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm';

import { Wallet } from '@modules/wallet/wallet.entity';
import { UserToken } from '@modules/user-token/user-token.entity';
import { Subscription } from '@modules/subscription/subscription.entity';
import { Replication } from '@modules/replication/replication.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: возвращается string
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
