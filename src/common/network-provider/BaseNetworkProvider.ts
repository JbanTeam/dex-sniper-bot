import { Network } from '@src/types/types';
import {
  CheckTokenParams,
  CheckTokenReturnType,
  CreateWalletReturnType,
  GetBalanceParams,
  SendNativeParams,
  SendTokensParams,
} from './types';

export abstract class BaseNetworkProvider {
  abstract createWallet(network: Network): Promise<CreateWalletReturnType>;
  abstract checkToken({ address, network }: CheckTokenParams): Promise<CheckTokenReturnType>;
  abstract getBalance({ chatId, address, network }: GetBalanceParams): Promise<string>;
  abstract monitorDex({ network }: { network: Network }): Promise<void>;
  abstract stopMonitoring(): void;
  abstract sendTokens({ userSession, wallet, token, amount, recipientAddress }: SendTokensParams): Promise<void>;
  abstract sendNative({ wallet, amount, recipientAddress }: SendNativeParams): Promise<void>;
}
