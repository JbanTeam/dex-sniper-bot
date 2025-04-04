import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDefaultToBuySellToSubscriptionEntity1743761398923 implements MigrationInterface {
  name = 'AddDefaultToBuySellToSubscriptionEntity1743761398923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" ALTER COLUMN "buy" SET DEFAULT '0'`);
    await queryRunner.query(`ALTER TABLE "subscription" ALTER COLUMN "sell" SET DEFAULT '0'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" ALTER COLUMN "sell" DROP DEFAULT`);
    await queryRunner.query(`ALTER TABLE "subscription" ALTER COLUMN "buy" DROP DEFAULT`);
  }
}
