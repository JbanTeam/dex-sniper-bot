import { EntityManager } from 'typeorm';
import { Address, Network } from '@src/types/types';

type CreateWalletParams = {
  network: Network;
  encryptedPrivateKey: string;
  address: Address;
  userId: number;
  entityManager?: EntityManager;
};

export { CreateWalletParams };
