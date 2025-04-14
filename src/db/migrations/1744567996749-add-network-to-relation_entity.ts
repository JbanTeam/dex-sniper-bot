import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNetworkToRelationEntity1744567996749 implements MigrationInterface {
  name = 'AddNetworkToRelationEntity1744567996749';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "replication" ADD "network" character varying NOT NULL DEFAULT 'BSC'`);
    await queryRunner.query(`ALTER TABLE "replication" ADD "userId" integer`);
    await queryRunner.query(
      `ALTER TABLE "replication" ADD CONSTRAINT "FK_4221f8a46a9d17b61b874caa3bc" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "replication" DROP CONSTRAINT "FK_4221f8a46a9d17b61b874caa3bc"`);
    await queryRunner.query(`ALTER TABLE "replication" DROP COLUMN "userId"`);
    await queryRunner.query(`ALTER TABLE "replication" DROP COLUMN "network"`);
  }
}
