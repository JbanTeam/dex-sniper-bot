import { Replication } from './replication.entity';
import { Address, TempReplication } from '@src/types/types';

type PrepareSessionReplication = {
  replication: Replication;
  tokenAddress: Address;
  tempReplication: TempReplication;
};

export { PrepareSessionReplication };
