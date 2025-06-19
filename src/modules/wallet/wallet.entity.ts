import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { IsEnum, IsEthereumAddress, IsString } from 'class-validator';

import { Address, Network } from '@src/types/types';
import { User } from '@modules/user/user.entity';
import { BaseEntity } from '@src/common/entities/base.entity';

@Entity()
export class Wallet extends BaseEntity {
  @Column({ enum: Network })
  @IsEnum(Network)
  network: Network;

  @Column()
  @IsEthereumAddress()
  address: Address;

  @Column({ name: 'encrypted_private_key' })
  @IsString()
  encryptedPrivateKey: string;

  @ManyToOne(() => User, user => user.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
