import { EntityManager, Repository } from 'typeorm';
import { createMock } from '@golevelup/ts-jest';
import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from '../user.service';
import { User } from '../user.entity';
import { BlockchainService } from '@modules/blockchain/blockchain.service';
import { getRepositoryToken } from '@nestjs/typeorm';

const mockUser = {
  id: 1,
  chatId: 123,
  createdAt: new Date(),
  wallets: [],
  tokens: [],
  subscriptions: [],
  replications: [],
} as User;

const mockBlockchainService = {
  createWallet: jest.fn(),
};

let mockEntityManager = {
  create: jest.fn<User, [typeof User, Partial<User>]>(),
  save: jest.fn(),
  delete: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

describe('UserService', () => {
  let userService: UserService;
  let userRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getRepositoryToken(User),
          useValue: createMock<Repository<User>>(),
        },
        {
          provide: BlockchainService,
          useValue: mockBlockchainService,
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));

    mockEntityManager = {
      create: jest.fn<User, [typeof User, Partial<User>]>(),
      save: jest.fn(),
      delete: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
  });

  describe('getOrCreateUser', () => {
    it('should retrieve an existing user', async () => {
      jest.spyOn(userService, 'findById').mockResolvedValue(mockUser);

      const result = await userService.getOrCreateUser(123);

      expect(result.action).toBe('get');
      expect(result.user).toEqual(mockUser);
    });

    it('should create a new user if not found', async () => {
      mockEntityManager.create.mockReturnValue(mockUser);
      mockEntityManager.save.mockResolvedValue(mockUser);
      userRepository.manager.transaction = jest
        .fn()
        .mockImplementation(async cb => cb(mockEntityManager) as EntityManager);
      jest.spyOn(userService, 'findById').mockResolvedValueOnce(null).mockResolvedValue(mockUser);

      const result = await userService.getOrCreateUser(123);

      expect(result.action).toBe('create');
      expect(result.user).toEqual(mockUser);
      expect(mockBlockchainService.createWallet).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find a user by id', async () => {
      jest.spyOn(userRepository.manager, 'findOne').mockResolvedValue(mockUser);

      const result = await userService.findById({ id: 1 });

      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      jest.spyOn(userRepository.manager, 'findOne').mockResolvedValue(null);

      const result = await userService.findById({ id: 1 });

      expect(result).toBeNull();
    });
  });
});
