import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { IsEnum, IsEthereumAddress, IsString } from 'class-validator';

import { User } from '@modules/user/user.entity';
import { Network } from '@src/types/types';

@Entity()
export class Wallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ enum: Network })
  @IsEnum(Network)
  network: Network;

  @Column()
  @IsEthereumAddress()
  address: string;

  @Column()
  @IsString()
  encryptedPrivateKey: string;

  @ManyToOne(() => User, user => user.wallets)
  user: User;
}
