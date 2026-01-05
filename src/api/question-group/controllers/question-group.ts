/**
 * question-group controller
 */

import { factories } from '@strapi/strapi';

type Result = { id?: string | number; status: string; message?: string };
type QuestionResult = { id?: string; status: string; message?: string; question?: string };

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

export default factories.createCoreController('api::question-group.question-group', ({ strapi }) => ({
  /**
   * POST /api/question-groups/bulk
   * Body: JSON array of question group objects, e.g.
   * [{ title: "RC Passage 1", type: "RC", stimulus: "<p>...</p>" }, …]
   */
  async bulkCreate(ctx) {
    const items = ctx.request.body;
    if (!Array.isArray(items)) {
      return ctx.badRequest('Body must be an array of question group objects');
    }

    const results: Result[] = [];

    for (const item of items) {
      try {
        if (!item.title || !item.stimulus) {
          throw new Error('title and stimulus are required fields');
        }

        const group = await strapi.documents('api::question-group.question-group').create({
          data: {
            title: item.title,
            type: item.type || 'RC',
            stimulus: item.stimulus,
            source: item.source || null
          }
        });
        results.push({ id: group.id, status: 'ok' });
      } catch (err: any) {
        results.push({
          status: 'error',
          message: err.message || 'Unknown error'
        });
      }
    }

    ctx.body = results;
  },

  /**
   * POST /api/question-groups/with-questions
   * Creates a question group along with its questions in one request.
   *
   * Body: {
   *   title: "RC Passage 1",           // required
   *   type: "RC",                       // RC, DI, LR, Other (default: RC)
   *   stimulus: "<p>...</p>",           // required - the passage/content
   *   source: "NYT 2024",               // optional
   *   tags: ["reading", "economy"],     // optional - tags for the group (string names or numeric IDs)
   *   questions: [                      // required - array of questions
   *     {
   *       question: "What is the main idea?",
   *       type: "MCQ",
   *       difficulty: "medium",
   *       options: [{ text: "Option A", is_correct: true }, ...],
   *       tags: ["inference"],          // optional - question-specific tags
   *       explanation: "...",
   *       hint: "..."
   *     },
   *     ...
   *   ]
   * }
   *
   * Response: {
   *   group: { id: 42, status: "ok" },
   *   questions: [{ id: "101", status: "ok" }, ...]
   * }
   */
  async createWithQuestions(ctx) {
    const body = ctx.request.body;

    // Validate required fields
    if (!body || typeof body !== 'object') {
      return ctx.badRequest('Request body must be an object');
    }

    if (!body.title) {
      return ctx.badRequest('title is required');
    }

    if (!body.stimulus) {
      return ctx.badRequest('stimulus is required');
    }

    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      return ctx.badRequest('questions array is required and must not be empty');
    }

    try {
      // 1) Collect all tags from group and questions for upsert
      const slugToDisplay: Record<string, string> = {};
      const slugSet = new Set<string>();

      // Group tags
      if (Array.isArray(body.tags)) {
        for (const raw of body.tags) {
          if (typeof raw === 'string') {
            const slug = slugify(raw);
            slugSet.add(slug);
            slugToDisplay[slug] = raw;
          }
        }
      }

      // Question tags
      for (const q of body.questions) {
        if (Array.isArray(q.tags)) {
          for (const raw of q.tags) {
            if (typeof raw === 'string') {
              const slug = slugify(raw);
              slugSet.add(slug);
              slugToDisplay[slug] = raw;
            }
          }
        }
      }

      const allSlugs = Array.from(slugSet);

      // 2) Fetch existing tags
      const nameToId: Record<string, string> = {};
      if (allSlugs.length > 0) {
        const existing = await strapi.documents('api::tag.tag').findMany({
          filters: { name: { $in: allSlugs } },
          fields: ['id', 'name']
        });

        existing.forEach((t: any) => {
          nameToId[t.name] = String(t.id);
        });

        // 3) Create missing tags
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
      }

      // 4) Resolve group tag IDs
      let groupTagIds: string[] = [];
      if (Array.isArray(body.tags)) {
        groupTagIds = body.tags
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

      // 5) Create the question group
      const groupData: any = {
        title: body.title,
        type: body.type || 'RC',
        stimulus: body.stimulus
      };

      if (body.source) {
        groupData.source = body.source;
      }

      const group = await strapi.entityService.create('api::question-group.question-group', {
        data: {
          ...groupData,
          ...(groupTagIds.length > 0 && { tags: groupTagIds.map(Number) })
        }
      });

      const groupResult = { id: group.id, status: 'ok' };

      // 6) Create questions linked to this group
      const questionResults: QuestionResult[] = [];

      for (const item of body.questions) {
        try {
          // Process question tags
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

          // Build question data
          const questionType = item.type || 'MCQ';
          const questionData: any = {
            question: item.question,
            type: questionType,
            difficulty: item.difficulty || 'medium',
            question_group: group.id
          };

          // Process options for MCQ questions
          if (questionType === 'MCQ') {
            if (!Array.isArray(item.options) || item.options.length < 2) {
              throw new Error(
                `MCQ questions must include at least two options. Question: ${item.question || 'Unknown'}`
              );
            }
            questionData.options = item.options;
          }

          // Add optional fields
          if (item.explanation !== undefined && item.explanation !== null) {
            questionData.explanation = String(item.explanation);
          }

          if (item.hint !== undefined && item.hint !== null) {
            questionData.hint = String(item.hint);
          }

          if (item.example !== undefined && item.example !== null) {
            questionData.example = String(item.example);
          }

          if (item.answer !== undefined && item.answer !== null) {
            questionData.answer = String(item.answer);
          }

          // Create the question
          const q = await strapi.entityService.create('api::question.question', {
            data: {
              ...questionData,
              ...(tagIds.length > 0 && { tags: tagIds.map(Number) })
            }
          });

          questionResults.push({ id: String(q.id), status: 'ok' });
        } catch (err: any) {
          questionResults.push({
            status: 'error',
            message: err.message || 'Unknown error occurred',
            question: item.question || 'Unknown question'
          });
        }
      }

      ctx.body = {
        group: groupResult,
        questions: questionResults
      };
    } catch (err: any) {
      strapi.log.error('Error creating question group with questions:', err);
      return ctx.internalServerError(err.message || 'Failed to create question group');
    }
  }
}));
