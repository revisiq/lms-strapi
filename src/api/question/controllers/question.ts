/**
 * question controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::question.question', ({ strapi }) => ({
  /**
   * POST /api/questions/bulk
   *   Expects an array of question objects in the body.
   *   Each object can include { stem, answer, example, tags, difficulty, ... }.
   */
  async bulkCreate(ctx) {
    const items = ctx.request.body;

    if (!Array.isArray(items)) {
      return ctx.badRequest('Request body must be an array of question objects');
    }

    const results: Array<{ id?: string | number; status: string; message?: string }> = [];

    for (const item of items) {
      try {
        // create each question via the Document Service
        const q = await strapi.documents('api::question.question').create({ data: item });
        results.push({ id: q.id, status: 'ok' });
      } catch (err: any) {
        results.push({
          status: 'error',
          message: err.message || 'Unknown error'
        });
      }
    }

    ctx.body = results;
  }
}));
