import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNameSymbolDecimalsToUserToken1741185306299 implements MigrationInterface {
  name = 'AddNameSymbolDecimalsToUserToken1741185306299';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_token" ADD "name" character varying NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_token" ADD "symbol" character varying NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user_token" ADD "decimals" integer NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user_token" DROP COLUMN "decimals"`);
    await queryRunner.query(`ALTER TABLE "user_token" DROP COLUMN "symbol"`);
    await queryRunner.query(`ALTER TABLE "user_token" DROP COLUMN "name"`);
  }
}
