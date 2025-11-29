/**
 * exam controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::exam.exam', ({ strapi }) => ({
  async findBySlug(ctx) {
    const slug = ctx.params?.slug?.trim();

    if (!slug) {
      return ctx.badRequest('slug parameter is required.');
    }

    const [exam] = await strapi.entityService.findMany('api::exam.exam', {
      filters: {
        slug: { $eq: slug }
      },
      populate: {
        sections: {
          sort: { display_order: 'asc' },
          populate: {
            topics: {
              sort: { display_order: 'asc' }
            }
          }
        }
      },
      limit: 1
    });

    if (!exam) {
      return ctx.notFound('Exam not found.');
    }

    ctx.set('Cache-Control', 'public, max-age=60');
    return this.transformResponse(exam);
  },

  async findOne(ctx) {
    // Override to use slug-based lookup instead of ID
    const slug = ctx.params?.id?.trim();

    if (!slug) {
      return ctx.badRequest('Slug parameter is required.');
    }

    const [exam] = await strapi.entityService.findMany('api::exam.exam', {
      filters: {
        slug: { $eq: slug }
      },
      populate: {
        sections: {
          sort: { display_order: 'asc' },
          populate: {
            topics: {
              sort: { display_order: 'asc' }
            }
          }
        }
      },
      limit: 1
    });

    if (!exam) {
      return ctx.notFound('Exam not found.');
    }

    ctx.set('Cache-Control', 'public, max-age=60');
    return this.transformResponse(exam);
  }
}));
