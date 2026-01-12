import type { Knex } from 'knex';

const QUESTION_TAG_INDEX = 'idx_questions_tags_question_id';
const TAG_QUESTION_INDEX = 'idx_questions_tags_tag_id';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `CREATE INDEX IF NOT EXISTS ${QUESTION_TAG_INDEX} ON questions_tags_links (question_id);`
  );
  await knex.raw(`CREATE INDEX IF NOT EXISTS ${TAG_QUESTION_INDEX} ON questions_tags_links (tag_id);`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP INDEX IF EXISTS ${QUESTION_TAG_INDEX};`);
  await knex.raw(`DROP INDEX IF EXISTS ${TAG_QUESTION_INDEX};`);
}
