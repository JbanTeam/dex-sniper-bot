import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1749121460165 implements MigrationInterface {
  name = 'Init1749121460165';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subscription" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "network" character varying NOT NULL, "user_id" integer, CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "replication" ("id" SERIAL NOT NULL, "network" character varying NOT NULL DEFAULT 'BSC', "buy" integer NOT NULL DEFAULT '0', "sell" integer NOT NULL DEFAULT '0', "user_id" integer, "subscription_id" integer, "token_id" integer, CONSTRAINT "PK_7c97aba530a59d827a5b118bdaf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_token" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "network" character varying NOT NULL DEFAULT 'BSC', "name" character varying NOT NULL, "symbol" character varying NOT NULL, "decimals" integer NOT NULL, "user_id" integer, CONSTRAINT "PK_48cb6b5c20faa63157b3c1baf7f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "chat_id" bigint NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c43d9c7669f5c12f23686e1b891" UNIQUE ("chat_id"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "wallet" ("id" SERIAL NOT NULL, "network" character varying NOT NULL, "address" character varying NOT NULL, "encrypted_private_key" character varying NOT NULL, "user_id" integer, CONSTRAINT "PK_bec464dd8d54c39c54fd32e2334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_940d49a105d50bbd616be540013" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "replication" ADD CONSTRAINT "FK_a70815747d9d1767901a420eb64" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "replication" ADD CONSTRAINT "FK_8e51477e137a7fd5c801326d055" FOREIGN KEY ("subscription_id") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "replication" ADD CONSTRAINT "FK_e50211d5c6158a9d029cbb1ade0" FOREIGN KEY ("token_id") REFERENCES "user_token"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token" ADD CONSTRAINT "FK_79ac751931054ef450a2ee47778" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet" ADD CONSTRAINT "FK_72548a47ac4a996cd254b082522" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet" DROP CONSTRAINT "FK_72548a47ac4a996cd254b082522"`);
    await queryRunner.query(`ALTER TABLE "user_token" DROP CONSTRAINT "FK_79ac751931054ef450a2ee47778"`);
    await queryRunner.query(`ALTER TABLE "replication" DROP CONSTRAINT "FK_e50211d5c6158a9d029cbb1ade0"`);
    await queryRunner.query(`ALTER TABLE "replication" DROP CONSTRAINT "FK_8e51477e137a7fd5c801326d055"`);
    await queryRunner.query(`ALTER TABLE "replication" DROP CONSTRAINT "FK_a70815747d9d1767901a420eb64"`);
    await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_940d49a105d50bbd616be540013"`);
    await queryRunner.query(`DROP TABLE "wallet"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "user_token"`);
    await queryRunner.query(`DROP TABLE "replication"`);
    await queryRunner.query(`DROP TABLE "subscription"`);
  }
}
