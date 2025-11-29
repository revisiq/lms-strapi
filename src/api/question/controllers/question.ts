// src/api/question/controllers/question.ts

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::question.question', ({ strapi }) => ({
  async bulkCreate(ctx) {
    let items = ctx.request.body;

    // Support both formats: array of objects or array of { data: {...} } objects
    if (!Array.isArray(items)) {
      return ctx.badRequest('Request body must be an array of question objects');
    }

    // Extract data from wrapper if present
    items = items.map((item: any) => {
      if (item && typeof item === 'object' && 'data' in item) {
        return item.data;
      }
      return item;
    });

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
          // Handle both string tags and numeric tag IDs
          if (typeof raw === 'string') {
            const slug = slugify(raw);
            slugSet.add(slug);
            slugToDisplay[slug] = raw;
          }
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

    // 4) Process and create questions
    const results: Array<{ id?: string; status: string; message?: string; question?: string }> = [];

    for (const item of items) {
      try {
        // Process tags: convert string tags to IDs, keep numeric IDs as-is
        let tagIds: string[] = [];
        if (Array.isArray(item.tags)) {
          tagIds = item.tags
            .map((tag: string | number) => {
              if (typeof tag === 'number') {
                return String(tag);
              }
              if (typeof tag === 'string') {
                return nameToId[slugify(tag)] || null;
              }
              return null;
            })
            .filter((id: string | null): id is string => id !== null);
        }

        // Process decks: ensure they're numeric IDs
        let deckIds: string[] = [];
        if (Array.isArray(item.decks)) {
          deckIds = item.decks
            .map((deck: number | string) => String(deck))
            .filter((id: string) => id && !isNaN(Number(id)));
        }

        // Build question data with all supported fields
        const questionType = item.type || 'MCQ';
        const questionData: any = {
          question: item.question,
          type: questionType,
          difficulty: item.difficulty || 'medium'
        };

        // Process options for MCQ questions
        if (questionType === 'MCQ') {
          if (!Array.isArray(item.options) || item.options.length === 0) {
            throw new Error(`MCQ questions must include at least one option. Question: ${item.question || 'Unknown'}`);
          }

          if (item.options.length < 2) {
            throw new Error(`MCQ questions must include at least two options. Question: ${item.question || 'Unknown'}`);
          }

          // Options are now a simple JSON array - just pass them as-is
          questionData.options = item.options;
        }

        // Add optional fields if provided
        if (item.explanation !== undefined && item.explanation !== null) {
          questionData.explanation = String(item.explanation);
        }

        if (item.hint !== undefined && item.hint !== null) {
          questionData.hint = String(item.hint);
        }

        if (item.example !== undefined && item.example !== null) {
          questionData.example = String(item.example);
        }

        if (item.group_id !== undefined && item.group_id !== null) {
          questionData.group_id = String(item.group_id).trim() || null;
        }

        // Create the question using entityService with proper format
        const q = await strapi.entityService.create('api::question.question', {
          data: {
            ...questionData,
            // Relations must use connect format for entityService
            ...(tagIds.length > 0 && { tags: tagIds }),
            ...(deckIds.length > 0 && { decks: deckIds })
          }
        });

        results.push({ id: String(q.id), status: 'ok' });
      } catch (err: any) {
        results.push({
          status: 'error',
          message: err.message || 'Unknown error occurred',
          question: item.question || 'Unknown question'
        });
      }
    }

    ctx.body = results;
  }
}));
