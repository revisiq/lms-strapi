/**
 * topic controller
 */

import { factories } from '@strapi/strapi'

export default factories.createCoreController('api::topic.topic', ({ strapi }) => ({
  async find(ctx) {
    // Check if filtering by section slug
    const filters: any = ctx.query?.filters || {};
    const sectionSlugFilter = filters?.section?.slug;
    
    if (sectionSlugFilter && typeof sectionSlugFilter === 'object' && sectionSlugFilter.$eq) {
      // Fetch section by slug to get its ID
      const sectionSlug = String(sectionSlugFilter.$eq).trim();
      
      if (!sectionSlug) {
        // Invalid slug, return empty result
        return ctx.send({
          data: [],
          meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
        });
      }

      const [section] = await strapi.entityService.findMany('api::section.section', {
        filters: { slug: { $eq: sectionSlug } },
        limit: 1,
      });

      if (!section || !section.id) {
        // Section not found, return empty result
        return ctx.send({
          data: [],
          meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
        });
      }

      // Replace slug filter with ID filter, preserving other filters
      const modifiedFilters = { ...filters };
      modifiedFilters.section = { id: { $eq: section.id } };
      
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
