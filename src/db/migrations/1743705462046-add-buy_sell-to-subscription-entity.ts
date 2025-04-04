import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBuySellToSubscriptionEntity1743705462046 implements MigrationInterface {
  name = 'AddBuySellToSubscriptionEntity1743705462046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" ADD "buy" integer NOT NULL`);
    await queryRunner.query(`ALTER TABLE "subscription" ADD "sell" integer NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "sell"`);
    await queryRunner.query(`ALTER TABLE "subscription" DROP COLUMN "buy"`);
  }
}
