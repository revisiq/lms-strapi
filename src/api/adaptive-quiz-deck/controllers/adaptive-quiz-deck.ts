/**
 * adaptive-quiz-deck controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::adaptive-quiz-deck.adaptive-quiz-deck', ({ strapi }) => ({
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
      return ctx.notFound('Adaptive quiz deck not found');
    }

    return response;
  },


  async getQuestionIndex(ctx) {
    const documentId = ctx.params?.documentId?.trim();

    if (!documentId) {
      return ctx.badRequest('documentId parameter is required.');
    }

    try {
      // Fetch the adaptive-quiz-deck with populated relations
      const deck = await strapi.documents('api::adaptive-quiz-deck.adaptive-quiz-deck').findOne({
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
        return ctx.notFound('Adaptive quiz deck not found.');
      }

      // Extract deck configuration
      const deckTags = deck.tags || [];
      const exclusionTags = deck.exclusions || [];
      const tagLogic = deck.tag_logic || 'ANY';
      const includeDifficulties = deck.include_difficulties || ['easy', 'medium', 'hard'];

      // Return empty if no tags present
      if (deckTags.length === 0) {
        const deckInfo = {
          id: deck.id,
          slug: deck.slug,
          title: deck.title,
          max_questions_per_session: deck.max_questions_per_session,
          keep_groups_together: deck.keep_groups_together,
          rule_policy: deck.rule_policy || null,
          exam: deck.topic?.section?.exam
            ? {
                name: deck.topic.section.exam.display_name,
                slug: deck.topic.section.exam.slug
              }
            : null,
          section: deck.topic?.section
            ? {
                name: deck.topic.section.display_name,
                slug: deck.topic.section.slug
              }
            : null,
          topic: deck.topic
            ? {
                id: deck.topic.id,
                name: deck.topic.display_name,
                slug: deck.topic.slug
              }
            : null
        };

        return {
          deck: deckInfo,
          questions: [],
          selectedTagIds: []
        };
      }

      const tagIds = deckTags.map((tag) => tag.id);
      const exclusionTagIds = exclusionTags.map((tag) => tag.id);

      // Build question filters
      // For ANY logic: match questions where question OR group has any of the tags
      // For ALL logic: match questions where question has at least one tag (will post-filter)
      const filters: any = {
        difficulty: { $in: includeDifficulties }
      };

      if (tagLogic === 'ANY') {
        filters.$or = [{ tags: { id: { $in: tagIds } } }, { question_group: { tags: { id: { $in: tagIds } } } }];
      } else {
        // For ALL, start with questions that have at least one required tag
        filters.tags = { id: { $in: tagIds } };
      }

      // Query questions with limit of 100
      const questions: any = await strapi.entityService.findMany('api::question.question', {
        filters,
        populate: {
          tags: true,
          question_group: {
            populate: {
              tags: true
            }
          }
        },
        limit: 100
      });

      // Post-filter questions based on tag_logic and exclusions
      const filteredQuestions = questions.filter((question: any) => {
        const questionTagIds = question.tags?.map((tag: any) => tag.id) || [];
        const groupTagIds = question.question_group?.tags?.map((tag: any) => tag.id) || [];
        // Combined tags: union of question tags and group tags
        const allTagIds = [...new Set([...questionTagIds, ...groupTagIds])];

        // Check if question or its group has any exclusion tags - if yes, exclude it
        if (exclusionTagIds.length > 0 && exclusionTagIds.some((exclusionId) => allTagIds.includes(exclusionId))) {
          return false;
        }

        // For "ALL" tag_logic, ensure combined tags contain all required tags
        if (tagLogic === 'ALL') {
          return tagIds.every((tagId) => allTagIds.includes(tagId));
        }

        // For "ANY" tag_logic, question already matches (from the query filter)
        return true;
      });

      // Transform questions to return only required fields
      const transformedQuestions = filteredQuestions.map((question: any) => ({
        id: question.id,
        difficulty: question.difficulty,
        question_group_id: question.question_group?.id || null,
        tag_ids: question.tags?.map((tag: any) => tag.id) || []
      }));

      // Build deck info response
      const deckInfo = {
        id: deck.id,
        slug: deck.slug,
        title: deck.title,
        max_questions_per_session: deck.max_questions_per_session,
        keep_groups_together: deck.keep_groups_together,
        rule_policy: deck.rule_policy || null,
        exam: deck.topic?.section?.exam
          ? {
              name: deck.topic.section.exam.display_name,
              slug: deck.topic.section.exam.slug
            }
          : null,
        section: deck.topic?.section
          ? {
              name: deck.topic.section.display_name,
              slug: deck.topic.section.slug
            }
          : null,
        topic: deck.topic
          ? {
              id: deck.topic.id,
              name: deck.topic.display_name,
              slug: deck.topic.slug
            }
          : null
      };

      return {
        deck: deckInfo,
        questions: transformedQuestions,
        selectedTagIds: tagIds
      };
    } catch (error) {
      strapi.log.error('Error fetching adaptive quiz question index:', error);
      return ctx.internalServerError('Failed to fetch question index');
    }
  }
}));
