/**
 * section controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::section.section', ({ strapi }) => ({
  async find(ctx) {
    // Check if filtering by exam slug
    const filters: any = ctx.query?.filters || {};
    const examSlugFilter = filters?.exam?.slug;
    
    if (examSlugFilter && typeof examSlugFilter === 'object' && examSlugFilter.$eq) {
      // Fetch exam by slug to get its ID
      const examSlug = String(examSlugFilter.$eq).trim();
      
      if (!examSlug) {
        // Invalid slug, return empty result
        return ctx.send({
          data: [],
          meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
        });
      }

      const [exam] = await strapi.entityService.findMany('api::exam.exam', {
        filters: { slug: { $eq: examSlug } },
        limit: 1,
      });

      if (!exam || !exam.id) {
        // Exam not found, return empty result
        return ctx.send({
          data: [],
          meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
        });
      }

      // Replace slug filter with ID filter, preserving other filters
      const modifiedFilters = { ...filters };
      modifiedFilters.exam = { id: { $eq: exam.id } };
      
      // Create modified query
      const modifiedQuery = {
        ...ctx.query,
        filters: modifiedFilters,
      };

      // Use parent controller's find method with modified query
      ctx.query = modifiedQuery;
    }

    // Call parent find method
    return await super.find(ctx);
  },
}));
