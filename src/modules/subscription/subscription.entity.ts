import { IsEnum, IsEthereumAddress, ValidateNested } from 'class-validator';
import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';

import { User } from '@modules/user/user.entity';
import { BaseEntity } from '@src/common/entities/base.entity';
import { Replication } from '@modules/replication/replication.entity';
import { Address, Network } from '@src/types/types';

@Entity()
export class Subscription extends BaseEntity {
  @Column()
  @IsEthereumAddress()
  address: Address;

  @Column({ enum: Network })
  @IsEnum(Network)
  network: Network;

  @ManyToOne(() => User, user => user.subscriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Replication, repl => repl.subscription, { cascade: true })
  @ValidateNested({ each: true })
  replications: Replication[];
}
