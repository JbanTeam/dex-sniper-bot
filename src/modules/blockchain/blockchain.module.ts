import { Module } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { WalletModule } from '@modules/wallet/wallet.module';
import { ViemProvider } from './viem/viem.provider';

@Module({
  imports: [WalletModule],
  providers: [BlockchainService, ViemProvider],
  exports: [BlockchainService],
})
export class BlockchainModule {}
