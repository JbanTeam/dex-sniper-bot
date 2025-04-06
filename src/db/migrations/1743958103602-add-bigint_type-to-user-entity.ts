import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBigintTypeToUserEntity1743958103602 implements MigrationInterface {
  name = 'AddBigintTypeToUserEntity1743958103602';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_1cfa1784ac9e67d4be782f4e5b8"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "chatId"`);
    await queryRunner.query(`ALTER TABLE "user" ADD "chatId" bigint NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_1cfa1784ac9e67d4be782f4e5b8" UNIQUE ("chatId")`);
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_01729d9465105fe07244458a523"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "telegramUserId"`);
    await queryRunner.query(`ALTER TABLE "user" ADD "telegramUserId" bigint NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_01729d9465105fe07244458a523" UNIQUE ("telegramUserId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_01729d9465105fe07244458a523"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "telegramUserId"`);
    await queryRunner.query(`ALTER TABLE "user" ADD "telegramUserId" integer NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_01729d9465105fe07244458a523" UNIQUE ("telegramUserId")`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP CONSTRAINT "UQ_1cfa1784ac9e67d4be782f4e5b8"`);
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "chatId"`);
    await queryRunner.query(`ALTER TABLE "user" ADD "chatId" integer NOT NULL`);
    await queryRunner.query(`ALTER TABLE "user" ADD CONSTRAINT "UQ_1cfa1784ac9e67d4be782f4e5b8" UNIQUE ("chatId")`);
  }
}
