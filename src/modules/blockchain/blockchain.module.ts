import { Module } from '@nestjs/common';

import { ViemProvider } from './viem/viem.provider';
import { BlockchainService } from './blockchain.service';
import { WalletModule } from '@modules/wallet/wallet.module';
import { RedisModule } from '@modules/redis/redis.module';
import { AnvilProvider } from './viem/anvil/anvil.provider';

@Module({
  imports: [WalletModule, RedisModule],
  providers: [BlockchainService, ViemProvider, AnvilProvider],
  exports: [BlockchainService],
})
export class BlockchainModule {}
