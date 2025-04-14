import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1744542528398 implements MigrationInterface {
  name = 'Init1744542528398';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "subscription" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "network" character varying NOT NULL, "userId" integer, CONSTRAINT "PK_8c3e00ebd02103caa1174cd5d9d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "replication" ("id" SERIAL NOT NULL, "buy" integer NOT NULL DEFAULT '0', "sell" integer NOT NULL DEFAULT '0', "subscriptionId" integer, "tokenId" integer, CONSTRAINT "PK_7c97aba530a59d827a5b118bdaf" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_token" ("id" SERIAL NOT NULL, "address" character varying NOT NULL, "network" character varying NOT NULL DEFAULT 'BSC', "name" character varying NOT NULL, "symbol" character varying NOT NULL, "decimals" integer NOT NULL, "userId" integer, CONSTRAINT "PK_48cb6b5c20faa63157b3c1baf7f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "chatId" bigint NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1cfa1784ac9e67d4be782f4e5b8" UNIQUE ("chatId"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "wallet" ("id" SERIAL NOT NULL, "network" character varying NOT NULL, "address" character varying NOT NULL, "encryptedPrivateKey" character varying NOT NULL, "userId" integer, CONSTRAINT "PK_bec464dd8d54c39c54fd32e2334" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscription" ADD CONSTRAINT "FK_cc906b4bc892b048f1b654d2aa0" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "replication" ADD CONSTRAINT "FK_469e5295aff0950019224d4f88d" FOREIGN KEY ("subscriptionId") REFERENCES "subscription"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "replication" ADD CONSTRAINT "FK_937d1735bf8ad2b00d2477e2324" FOREIGN KEY ("tokenId") REFERENCES "user_token"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_token" ADD CONSTRAINT "FK_d37db50eecdf9b8ce4eedd2f918" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "wallet" ADD CONSTRAINT "FK_35472b1fe48b6330cd349709564" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wallet" DROP CONSTRAINT "FK_35472b1fe48b6330cd349709564"`);
    await queryRunner.query(`ALTER TABLE "user_token" DROP CONSTRAINT "FK_d37db50eecdf9b8ce4eedd2f918"`);
    await queryRunner.query(`ALTER TABLE "replication" DROP CONSTRAINT "FK_937d1735bf8ad2b00d2477e2324"`);
    await queryRunner.query(`ALTER TABLE "replication" DROP CONSTRAINT "FK_469e5295aff0950019224d4f88d"`);
    await queryRunner.query(`ALTER TABLE "subscription" DROP CONSTRAINT "FK_cc906b4bc892b048f1b654d2aa0"`);
    await queryRunner.query(`DROP TABLE "wallet"`);
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "user_token"`);
    await queryRunner.query(`DROP TABLE "replication"`);
    await queryRunner.query(`DROP TABLE "subscription"`);
  }
}
