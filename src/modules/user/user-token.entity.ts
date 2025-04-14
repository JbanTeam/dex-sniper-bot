import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { IsEthereumAddress, IsEnum, IsString, IsNumber, ValidateNested } from 'class-validator';

import { User } from './user.entity';
import { Network } from '@src/types/types';
import { Replication } from '@modules/subscription/replication.entity';

@Entity()
export class UserToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsEthereumAddress()
  address: `0x${string}`;

  @Column({ enum: Network, default: Network.BSC })
  @IsEnum(Network)
  network: Network;

  @Column()
  @IsString()
  name: string;

  @Column()
  @IsString()
  symbol: string;

  @Column()
  @IsNumber()
  decimals: number;

  @ManyToOne(() => User, user => user.tokens, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => Replication, repl => repl.token, { cascade: true })
  @ValidateNested({ each: true })
  replications: Replication[];
}
