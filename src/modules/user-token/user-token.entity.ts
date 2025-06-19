import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { IsEthereumAddress, IsEnum, IsString, IsNumber, ValidateNested } from 'class-validator';

import { Address, Network } from '@src/types/types';
import { User } from '@modules/user/user.entity';
import { Replication } from '@modules/replication/replication.entity';
import { BaseEntity } from '@src/common/entities/base.entity';

@Entity()
export class UserToken extends BaseEntity {
  @Column()
  @IsEthereumAddress()
  address: Address;

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
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Replication, repl => repl.token, { cascade: true })
  @ValidateNested({ each: true })
  replications: Replication[];
}
