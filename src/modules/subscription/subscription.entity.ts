import { IsEnum, IsEthereumAddress, ValidateNested } from 'class-validator';
import { Entity, Column, ManyToOne, OneToMany } from 'typeorm';

import { Network } from '@src/types/types';
import { User } from '@modules/user/user.entity';
import { Replication } from '@modules/replication/replication.entity';
import { BaseEntity } from '@src/common/entities/base.entity';

@Entity()
export class Subscription extends BaseEntity {
  @Column()
  @IsEthereumAddress()
  address: `0x${string}`;

  @Column({ enum: Network })
  @IsEnum(Network)
  network: Network;

  @ManyToOne(() => User, user => user.subscriptions, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => Replication, repl => repl.subscription, { cascade: true })
  @ValidateNested({ each: true })
  replications: Replication[];
}
