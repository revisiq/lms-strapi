// src/api/question/controllers/question.ts

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::question.question', ({ strapi }) => ({
  async bulkCreate(ctx) {
    const items = ctx.request.body;
    if (!Array.isArray(items)) {
      return ctx.badRequest('Request body must be an array of question objects');
    }

    // 1) Normalize tag names → slugs & map to display names
    const slugify = (s: string) =>
      s
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
    const slugToDisplay: Record<string, string> = {};
    const slugSet = new Set<string>();

    for (const item of items) {
      if (Array.isArray(item.tags)) {
        for (const raw of item.tags) {
          const slug = slugify(raw);
          slugSet.add(slug);
          slugToDisplay[slug] = raw;
        }
      }
    }
    const allSlugs = Array.from(slugSet);

    // 2) Fetch existing tags by name (slug) using filters
    const existing = await strapi.documents('api::tag.tag').findMany({
      filters: { name: { $in: allSlugs } },
      select: ['id', 'name']
    });

    // Map slug → id for existing
    const nameToId: Record<string, string> = {};
    existing.forEach((t) => {
      nameToId[t.name] = String(t.id);
    });

    // 3) Create any missing tags one by one
    const missing = allSlugs.filter((slug) => !nameToId[slug]);
    for (const slug of missing) {
      const created = await strapi.documents('api::tag.tag').create({
        data: {
          name: slug,
          display_name: slugToDisplay[slug]
        }
      });
      nameToId[slug] = String(created.id);
    }

    // 4) Now create questions, replacing tag strings with IDs
    const results: Array<{ id?: string; status: string; message?: string }> = [];
    for (const item of items) {
      const tagIds = Array.isArray(item.tags) ? item.tags.map((raw: string) => nameToId[slugify(raw)]) : [];

      try {
        const q = await strapi.documents('api::question.question').create({
          data: {
            ...item,
            tags: tagIds
          }
        });
        results.push({ id: String(q.id), status: 'ok' });
      } catch (err: any) {
        results.push({ status: 'error', message: err.message });
      }
    }

    ctx.body = results;
  }
}));
