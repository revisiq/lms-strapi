/**
 * tag controller
 */

import { factories } from '@strapi/strapi';
type Result = { id?: string | number; status: string; message?: string };

export default factories.createCoreController('api::tag.tag', ({ strapi }) => ({
  /**
   * POST /api/tags/bulk
   * Body: JSON array of tag objects, e.g.
   * [{ name: "idioms", slug: "idioms", type: "custom" }, …]
   */
  async bulkCreate(ctx) {
    const items = ctx.request.body;
    if (!Array.isArray(items)) {
      return ctx.badRequest('Body must be an array of tag objects');
    }

    const results: Result[] = [];

    for (const item of items) {
      try {
        const tag = await strapi.documents('api::tag.tag').create({ data: item });
        results.push({ id: tag.id, status: 'ok' });
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
