import { IsEnum, IsEthereumAddress, ValidateNested } from 'class-validator';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';

import { User } from '../user/user.entity';
import { Network } from '@src/types/types';
import { Replication } from './replication.entity';

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

  @ManyToOne(() => User, user => user.subscriptions, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => Replication, repl => repl.subscription, { cascade: true })
  @ValidateNested({ each: true })
  replications: Replication[];
}
