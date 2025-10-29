/**
 * mcq-set controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::mcq-set.mcq-set', ({ strapi }) => ({
  async findBySlug(ctx) {
    const { slug } = ctx.params;

    if (typeof slug !== 'string' || !slug.trim()) {
      return ctx.badRequest('Slug parameter is required.');
    }

    const normalizedSlug = slug.trim().toLowerCase();

    const sanitizedQuery = ((await this.sanitizeQuery(ctx)) ?? {}) as Record<string, any>;

    const existingFilters =
      typeof sanitizedQuery.filters === 'object' && sanitizedQuery.filters !== null
        ? sanitizedQuery.filters
        : {};

    sanitizedQuery.filters = {
      ...existingFilters,
      slug: normalizedSlug
    };

    sanitizedQuery.limit = 1;

    const [entity] = await strapi.entityService.findMany('api::mcq-set.mcq-set', sanitizedQuery);

    if (!entity) {
      return ctx.notFound('MCQ set not found for the provided slug.');
    }

    const sanitizedEntity = await this.sanitizeOutput(entity, ctx);
    return this.transformResponse(sanitizedEntity);
  }
}));
