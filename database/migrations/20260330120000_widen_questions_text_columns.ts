import type { Knex } from 'knex';

const isPostgres = (knex: Knex) => {
  const client = knex.client.config.client;
  return client === 'pg' || client === 'postgres';
};

/**
 * Align `questions` string columns with `api::question.question` schema max lengths.
 * Older Strapi/DB setups often leave these as varchar(255), which breaks bulk inserts.
 */
export async function up(knex: Knex): Promise<void> {
  if (!isPostgres(knex)) {
    return;
  }

  const hasTable = await knex.schema.hasTable('questions');
  if (!hasTable) {
    return;
  }

  await knex.raw('ALTER TABLE questions ALTER COLUMN question TYPE varchar(1000)');
  await knex.raw('ALTER TABLE questions ALTER COLUMN hint TYPE varchar(140)');
  await knex.raw('ALTER TABLE questions ALTER COLUMN example TYPE varchar(150)');
  await knex.raw('ALTER TABLE questions ALTER COLUMN explanation TYPE varchar(400)');
}

export async function down(): Promise<void> {
  // Intentionally empty: shrinking columns can truncate data and Strapi does not rely on `down`.
}
