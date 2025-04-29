import { Module } from '@nestjs/common';

import { ViemProvider } from './viem/viem.provider';
import { AnvilProvider } from './viem/anvil/anvil.provider';
import { ViemHelperProvider } from './viem/viem-helper.provider';
import { BlockchainService } from './blockchain.service';
import { WalletModule } from '@modules/wallet/wallet.module';
import { RedisModule } from '@modules/redis/redis.module';
import { SubscriptionModule } from '@modules/subscription/subscription.module';

@Module({
  imports: [WalletModule, RedisModule, SubscriptionModule],
  providers: [BlockchainService, ViemProvider, AnvilProvider, ViemHelperProvider],
  exports: [BlockchainService],
})
export class BlockchainModule {}
