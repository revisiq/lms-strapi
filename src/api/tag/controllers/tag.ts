/**
 * tag controller
 */

import { factories } from '@strapi/strapi';
type Result = { id?: string | number; status: string; message?: string };

export default factories.createCoreController('api::tag.tag', ({ strapi }) => ({
  // Override find to filter invisible decks from results
  async find(ctx) {
    const response = await super.find(ctx);

    // Filter invisible decks from each tag
    if (response?.data) {
      response.data = response.data.map(filterInvisibleDecksFromTag);
    }

    return response;
  },

  // Override findOne to filter invisible decks from result
  async findOne(ctx) {
    const response = await super.findOne(ctx);

    if (response?.data) {
      response.data = filterInvisibleDecksFromTag(response.data);
    }

    return response;
  },

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

/**
 * Filters out decks with visible: false from a tag's relations
 */
function filterInvisibleDecksFromTag(tag: any): any {
  if (!tag?.attributes?.decks?.data) {
    return tag;
  }

  const visibleDecks = tag.attributes.decks.data.filter(
    (deck: any) => deck?.attributes?.visible === true
  );

  return {
    ...tag,
    attributes: {
      ...tag.attributes,
      decks: {
        ...tag.attributes.decks,
        data: visibleDecks
      }
    }
  };
}
