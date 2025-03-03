import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { IsEthereumAddress, IsEnum } from 'class-validator';

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

  @ManyToOne(() => User, user => user.tokens)
  user: User;
}
