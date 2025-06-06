import { IsNumber, ValidateNested } from 'class-validator';
import { Entity, Column, OneToMany, CreateDateColumn } from 'typeorm';

import { Wallet } from '@modules/wallet/wallet.entity';
import { UserToken } from '@modules/user-token/user-token.entity';
import { Subscription } from '@modules/subscription/subscription.entity';
import { Replication } from '@modules/replication/replication.entity';
import { BaseEntity } from '@src/common/entities/base.entity';

@Entity()
export class User extends BaseEntity {
  // TODO: возвращается string
  @Column({ unique: true, type: 'bigint' })
  @IsNumber()
  chat_id: number;

  @CreateDateColumn()
  created_at: Date;

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
