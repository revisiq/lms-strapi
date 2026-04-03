'use strict';

/** Widen varchar(255) columns to match Question schema (legacy DBs). */
async function up(knex) {
  const client = knex.client.config.client;
  if (client !== 'pg' && client !== 'postgres') {
    return;
  }

  const hasTable = await knex.schema.hasTable('questions');
  if (!hasTable) {
    return;
  }

  await knex.raw('ALTER TABLE questions ALTER COLUMN question TYPE text');
  await knex.raw('ALTER TABLE questions ALTER COLUMN hint TYPE varchar(140)');
  await knex.raw('ALTER TABLE questions ALTER COLUMN example TYPE varchar(150)');
  await knex.raw('ALTER TABLE questions ALTER COLUMN explanation TYPE varchar(400)');
}

module.exports = { up };
