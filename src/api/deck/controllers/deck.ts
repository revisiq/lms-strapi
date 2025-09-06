/**
 * deck controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::deck.deck', () => ({
  async find(ctx) {
    ctx.query = {
      ...ctx.query,
      sort: ctx.query.sort || 'display_order:asc'
    };

    return await super.find(ctx);
  }
}));

