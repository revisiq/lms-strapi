/**
 * adaptive-quiz-deck controller
 */

import { factories } from '@strapi/strapi';

const ADAPTIVE_DECK_UID = 'api::adaptive-quiz-deck.adaptive-quiz-deck';
const TOPIC_UID = 'api::topic.topic';
const TAG_UID = 'api::tag.tag';

type BulkAdaptiveDeckItem = {
  topic?: number | string;
  topic_id?: number | string;
  topic_slug?: string;
  title?: string;
  titlePrefix?: string;
  slug?: string;
  slugPrefix?: string;
  tags?: Array<string | number>;
  exclusions?: Array<string | number>;
  tag_logic?: 'ANY' | 'ALL';
  include_difficulties?: string[];
  batch_size?: number;
  max_questions_per_session?: number;
  rule_policy?: string;
  keep_groups_together?: boolean;
  visible?: boolean;
};

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

function unwrapBulkItems(items: unknown): BulkAdaptiveDeckItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item: any) => {
      if (item && typeof item === 'object' && 'data' in item) {
        return item.data;
      }
      return item;
    })
    .filter((item: any) => item && typeof item === 'object');
}

async function resolveTagNamesToIdsForBulk(strapi: any, rawTags: Array<string>) {
  const slugToDisplay: Record<string, string> = {};
  const slugSet = new Set<string>();

  for (const raw of rawTags) {
    const slug = slugify(raw);
    if (!slug) continue;
    slugSet.add(slug);
    slugToDisplay[slug] = raw;
  }

  const allSlugs = Array.from(slugSet);
  if (!allSlugs.length) {
    return {};
  }

  const existing = await strapi.documents(TAG_UID).findMany({
    filters: { name: { $in: allSlugs } },
    select: ['id', 'name']
  });

  const nameToId: Record<string, string> = {};
  existing.forEach((t: any) => {
    nameToId[t.name] = String(t.id);
  });

  const missing = allSlugs.filter((slug) => !nameToId[slug]);
  for (const slug of missing) {
    const created = await strapi.documents(TAG_UID).create({
      data: {
        name: slug,
        display_name: slugToDisplay[slug] || slug
      }
    });
    nameToId[slug] = String(created.id);
  }

  return nameToId;
}

export default factories.createCoreController(ADAPTIVE_DECK_UID, ({ strapi }) => ({
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

  /**
   * POST /api/adaptive-quiz-decks/bulk
   * Creates one adaptive quiz deck per item and auto-creates missing tags.
   */
  async bulkCreate(ctx) {
    let items = unwrapBulkItems(ctx.request.body);

    if (!items.length) {
      return ctx.badRequest('Request body must be a non-empty array of adaptive quiz deck objects');
    }

    const topicIds = new Set<number>();
    const topicSlugs = new Set<string>();

    for (const it of items) {
      const rawTopic = it.topic_slug ?? it.topic_id ?? it.topic;
      if (typeof rawTopic === 'number') {
        if (Number.isFinite(rawTopic) && rawTopic > 0) topicIds.add(rawTopic);
        continue;
      }

      if (typeof rawTopic === 'string') {
        const trimmed = rawTopic.trim();
        if (!trimmed) continue;
        const asNumber = Number(trimmed);
        if (Number.isFinite(asNumber) && asNumber > 0 && String(asNumber) === trimmed) {
          topicIds.add(asNumber);
        } else {
          // Treat as topic slug (e.g. `ssc-cgl-topic-analogies`)
          topicSlugs.add(slugify(trimmed));
        }
      }
    }

    const idList = Array.from(topicIds);
    const slugList = Array.from(topicSlugs);

    const topicEntities = await strapi.documents(TOPIC_UID).findMany({
      filters: {
        ...(idList.length
          ? { id: { $in: idList } }
          : {}),
        ...(slugList.length
          ? { slug: { $in: slugList } }
          : {})
      },
      select: ['id', 'display_name', 'slug'],
      limit: Math.max(idList.length, slugList.length)
    });

    const topicById = new Map<number, any>();
    const topicBySlug = new Map<string, any>();
    topicEntities.forEach((t: any) => {
      topicById.set(Number(t.id), t);
      if (typeof t.slug === 'string') topicBySlug.set(slugify(t.slug), t);
    });

    const rawTagInputs: string[] = [];
    for (const it of items) {
      for (const tag of it.tags ?? []) {
        if (typeof tag === 'string') rawTagInputs.push(tag);
      }
      for (const tag of it.exclusions ?? []) {
        if (typeof tag === 'string') rawTagInputs.push(tag);
      }
    }

    const nameToId = await resolveTagNamesToIdsForBulk(strapi, rawTagInputs);

    const results: Array<{ id?: string; status: 'ok' | 'error'; message?: string }> = [];

    const normalizeIds = (values: Array<string | number> | undefined) => {
      const arr = Array.isArray(values) ? values : [];
      const out: string[] = [];
      for (const v of arr) {
        if (typeof v === 'number') {
          if (Number.isFinite(v) && v > 0) out.push(String(v));
          continue;
        }
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (!trimmed) continue;
          const asNumber = Number(trimmed);
          if (Number.isFinite(asNumber) && asNumber > 0 && String(asNumber) === trimmed) {
            out.push(String(asNumber));
            continue;
          }
          const slug = slugify(trimmed);
          const id = nameToId[slug];
          if (id) out.push(id);
          continue;
        }
      }
      return out;
    };

    for (const it of items) {
      try {
        const rawTopic = it.topic_slug ?? it.topic_id ?? it.topic;
        let topic: any = null;

        if (typeof rawTopic === 'number') {
          if (!Number.isFinite(rawTopic) || rawTopic <= 0) {
            throw new Error('topic must be a positive number');
          }
          topic = topicById.get(rawTopic) ?? null;
        } else if (typeof rawTopic === 'string') {
          const trimmed = rawTopic.trim();
          const asNumber = Number(trimmed);
          if (Number.isFinite(asNumber) && asNumber > 0 && String(asNumber) === trimmed) {
            topic = topicById.get(asNumber) ?? null;
          } else {
            topic = topicBySlug.get(slugify(trimmed)) ?? null;
          }
        }

        if (!topic) {
          throw new Error('Topic not found. Provide valid `topic` id or slug.');
        }

        const titlePrefix =
          typeof it.titlePrefix === 'string' && it.titlePrefix.trim().length
            ? it.titlePrefix.trim()
            : 'SSC CGL Adaptive';

        const slugPrefix =
          typeof it.slugPrefix === 'string' && it.slugPrefix.trim().length
            ? it.slugPrefix.trim()
            : 'ssc-cgl-adaptive';

        const title =
          typeof it.title === 'string' && it.title.trim().length
            ? it.title.trim()
            : `${titlePrefix} - ${topic.display_name ?? topic.slug ?? String(topic.id)}`;

        const slug =
          typeof it.slug === 'string' && it.slug.trim().length
            ? it.slug.trim()
            : slugify(`${slugPrefix}-${topic.slug ?? topic.display_name ?? topic.id}`);

        const tagIds = normalizeIds(it.tags);
        const exclusionTagIds = normalizeIds(it.exclusions);

        const data: any = {
          title,
          slug,
          topic: topic.id,
          tag_logic: it.tag_logic ?? 'ANY',
          visible: typeof it.visible === 'boolean' ? it.visible : true,
          keep_groups_together: typeof it.keep_groups_together === 'boolean' ? it.keep_groups_together : true
        };

        if (Array.isArray(it.include_difficulties) && it.include_difficulties.length) {
          data.include_difficulties = it.include_difficulties;
        }
        if (typeof it.batch_size === 'number') data.batch_size = it.batch_size;
        if (typeof it.max_questions_per_session === 'number') {
          data.max_questions_per_session = it.max_questions_per_session;
        }
        if (typeof it.rule_policy === 'string') data.rule_policy = it.rule_policy;

        if (tagIds.length > 0) data.tags = tagIds;
        if (exclusionTagIds.length > 0) data.exclusions = exclusionTagIds;

        const created = await strapi.entityService.create(ADAPTIVE_DECK_UID, { data });
        results.push({ id: String(created.id), status: 'ok' });
      } catch (err: any) {
        results.push({
          status: 'error',
          message: err.message || 'Unknown error'
        });
      }
    }

    ctx.body = results;
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
