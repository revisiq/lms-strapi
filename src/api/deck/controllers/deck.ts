/**
 * deck controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::deck.deck', () => ({
  async find(ctx) {
    const originalFilters = ctx.query?.filters;
    const visibilityFilter = originalFilters
      ? { $and: [originalFilters, { visible: true }] }
      : { visible: true };

    ctx.query = {
      ...ctx.query,
      sort: ctx.query?.sort || 'display_order:asc',
      filters: visibilityFilter
    };

    return await super.find(ctx);
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    const isVisible = response?.data?.attributes?.visible ?? false;

    if (!isVisible) {
      return ctx.notFound('Deck not found');
    }

    return response;
  }
}));
