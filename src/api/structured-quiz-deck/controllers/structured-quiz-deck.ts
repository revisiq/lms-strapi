/**
 * structured-quiz-deck controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::structured-quiz-deck.structured-quiz-deck', ({ strapi }) => ({
  // Filter decks by visibility in find
  async find(ctx) {
    const originalFilters = ctx.query?.filters;
    const visibilityFilter = originalFilters
      ? { $and: [originalFilters, { visible: true }] }
      : { visible: true };

    ctx.query = {
      ...ctx.query,
      filters: visibilityFilter
    };

    return await super.find(ctx);
  },

  // Check visibility in findOne
  async findOne(ctx) {
    const response = await super.findOne(ctx);
    const isVisible = response?.data?.attributes?.visible ?? false;

    if (!isVisible) {
      return ctx.notFound('Structured quiz deck not found');
    }

    return response;
  },


  async getQuestionIndex(ctx) {
    const documentId = ctx.params?.documentId?.trim();

    if (!documentId) {
      return ctx.badRequest('documentId parameter is required.');
    }

    try {
      // Fetch the structured-quiz-deck with populated relations
      const deck = await strapi.documents('api::structured-quiz-deck.structured-quiz-deck').findOne({
        documentId,
        populate: {
          tags: true,
          exclusions: true,
          topic: {
            populate: {
              section: {
                populate: {
                  exam: true
                }
              }
            }
          }
        }
      });

      if (!deck) {
        return ctx.notFound('Structured quiz deck not found.');
      }

      const orderedItems = (Array.isArray(deck.ordered_items) ? deck.ordered_items : []) as Array<{
        kind: 'question' | 'group';
        id: number;
      }>;

      if (orderedItems.length === 0) {
        const deckInfo = buildDeckInfo(deck);
        return {
          deck: deckInfo,
          questions: [],
          groups: {}
        };
      }

      // Separate group IDs and standalone question IDs
      const groupIds: number[] = [];
      const standaloneQuestionIds: number[] = [];

      for (const item of orderedItems) {
        if (item.kind === 'group') {
          groupIds.push(item.id);
        } else if (item.kind === 'question') {
          standaloneQuestionIds.push(item.id);
        }
      }

      // Fetch all questions belonging to the groups
      let groupQuestions: any[] = [];
      if (groupIds.length > 0) {
        groupQuestions = await strapi.entityService.findMany('api::question.question', {
          filters: {
            question_group: { id: { $in: groupIds } }
          },
          populate: {
            tags: true,
            question_group: true
          },
          limit: 500
        });
      }

      // Fetch standalone questions
      let standaloneQuestions: any[] = [];
      if (standaloneQuestionIds.length > 0) {
        standaloneQuestions = await strapi.entityService.findMany('api::question.question', {
          filters: {
            id: { $in: standaloneQuestionIds }
          },
          populate: {
            tags: true,
            question_group: true
          },
          limit: 500
        });
      }

      // Build a map of group_id -> questions for ordering
      const questionsByGroup = new Map<number, any[]>();
      for (const q of groupQuestions) {
        const gid = q.question_group?.id;
        if (gid) {
          if (!questionsByGroup.has(gid)) {
            questionsByGroup.set(gid, []);
          }
          questionsByGroup.get(gid)!.push(q);
        }
      }

      // Build a map of question_id -> question for standalone
      const standaloneMap = new Map<number, any>();
      for (const q of standaloneQuestions) {
        standaloneMap.set(q.id, q);
      }

      // Build ordered question list based on ordered_items
      const orderedQuestions: any[] = [];
      const seenIds = new Set<number>();

      for (const item of orderedItems) {
        if (item.kind === 'group') {
          const groupQs = questionsByGroup.get(item.id) || [];
          for (const q of groupQs) {
            if (!seenIds.has(q.id)) {
              orderedQuestions.push(q);
              seenIds.add(q.id);
            }
          }
        } else if (item.kind === 'question') {
          const q = standaloneMap.get(item.id);
          if (q && !seenIds.has(q.id)) {
            orderedQuestions.push(q);
            seenIds.add(q.id);
          }
        }
      }

      // Transform questions to response format
      const transformedQuestions = orderedQuestions.map((q: any) => ({
        id: q.id,
        difficulty: q.difficulty,
        question_group_id: q.question_group?.id || null,
        tag_ids: q.tags?.map((t: any) => t.id) || []
      }));

      // Fetch group details
      const uniqueGroupIds = [
        ...new Set(
          orderedQuestions
            .map((q: any) => q.question_group?.id)
            .filter((id): id is number => id !== null && id !== undefined)
        )
      ];

      const groups: Record<number, any> = {};

      if (uniqueGroupIds.length > 0) {
        const groupEntities = await strapi.entityService.findMany('api::question-group.question-group', {
          filters: { id: { $in: uniqueGroupIds } },
          populate: { tags: true },
          limit: uniqueGroupIds.length
        });

        for (const g of groupEntities as any[]) {
          groups[g.id] = {
            id: g.id,
            type: g.type,
            title: g.title,
            stimulus: g.stimulus,
            source: g.source || null,
            tag_ids: g.tags?.map((t: any) => t.id) || []
          };
        }
      }

      const deckInfo = buildDeckInfo(deck);

      ctx.set('Cache-Control', 'public, max-age=60');
      return {
        deck: deckInfo,
        questions: transformedQuestions,
        groups
      };
    } catch (error) {
      strapi.log.error('Error fetching structured quiz question index:', error);
      return ctx.internalServerError('Failed to fetch question index');
    }
  }
}));

function buildDeckInfo(deck: any) {
  return {
    id: deck.id,
    documentId: deck.documentId,
    slug: deck.slug,
    title: deck.title,
    variant: 'structured' as const,
    keep_groups_together: deck.keep_groups_together ?? true,
    tag_logic: deck.tag_logic || 'ANY',
    exam: deck.topic?.section?.exam
      ? {
          name: deck.topic.section.exam.name,
          slug: deck.topic.section.exam.slug
        }
      : null,
    section: deck.topic?.section
      ? {
          name: deck.topic.section.name,
          slug: deck.topic.section.slug
        }
      : null,
    topic: deck.topic
      ? {
          id: deck.topic.id,
          name: deck.topic.name,
          slug: deck.topic.slug
        }
      : null
  };
}
