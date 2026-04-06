import type { Core } from '@strapi/strapi';
import type { Knex } from 'knex';

const QUESTION_TABLE = 'questions';
const QUESTION_OPTION_LINKS = 'questions_components_question_options_links';

const backfillQuestionMetadata = async (strapi: Core.Strapi) => {
  const knex = strapi.db.connection as Knex;

  const hasQuestionsTable = await knex.schema.hasTable(QUESTION_TABLE);
  if (!hasQuestionsTable) {
    return;
  }

  const hasDifficulty = await knex.schema.hasColumn(QUESTION_TABLE, 'difficulty');
  if (hasDifficulty) {
    await knex(QUESTION_TABLE)
      .where((qb) => {
        qb.whereNull('difficulty').orWhere('difficulty', '');
      })
      .update({ difficulty: 'medium' });
  }

  const hasType = await knex.schema.hasColumn(QUESTION_TABLE, 'type');
  if (hasType) {
    await knex(QUESTION_TABLE)
      .where((qb) => {
        qb.whereNull('type').orWhere('type', '');
      })
      .update({ type: 'Other' });

    const hasOptionLinks = await knex.schema.hasTable(QUESTION_OPTION_LINKS);

    if (hasOptionLinks) {
      const mcqCandidates = (await knex(QUESTION_OPTION_LINKS)
        .select('question_id')
        .count<{ question_id: number }>('component_id as option_count')
        .groupBy('question_id')
        .havingRaw('COUNT(component_id) >= 2')) as Array<{ question_id: number }>;

      const mcqIds = mcqCandidates.map((row) => Number(row.question_id)).filter((id) => Number.isFinite(id) && id > 0);

      if (mcqIds.length) {
        await knex(QUESTION_TABLE).whereIn('id', mcqIds).update({ type: 'MCQ' });
      }
    }
  }
};

export default {
  register({ strapi }: { strapi: Core.Strapi }) {
    // Register before filesystem API routes (see initRouting). Route files use readdir order, which
    // differs between macOS and Linux; a GET /exams/:slug layer can win over POST /exams/bulk/create
    // and produce 405 from koa-router allowedMethods().
    strapi.server.routes({
      type: 'content-api',
      routes: [
        {
          method: 'POST',
          path: '/exams/bulk/create',
          handler: 'exam.bulkCreateNested',
          config: { auth: false },
          info: { apiName: 'exam' }
        }
      ]
    });
  },
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await backfillQuestionMetadata(strapi);
  }
};
