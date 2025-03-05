import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { IsEthereumAddress, IsEnum, IsString, IsNumber } from 'class-validator';

import { User } from './user.entity';
import { Network } from '@src/types/types';

@Entity()
export class UserToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsEthereumAddress()
  address: string;

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

  @ManyToOne(() => User, user => user.tokens)
  user: User;
}
