import { errors } from '@strapi/utils';

declare const strapi: any;

const { ValidationError } = errors;

const QUESTION_UID = 'api::question.question';
const ADAPTIVE_UID = 'api::adaptive-quiz-deck.adaptive-quiz-deck';
const STRUCTURED_UID = 'api::structured-quiz-deck.structured-quiz-deck';
const MAX_IDS_PER_REQUEST = 50;
const INDEX_PAGE_SIZE = 200;
const CACHE_HEADER = 'public, max-age=60';
const ALLOWED_DIFFICULTIES = ['easy', 'medium', 'hard'];

type TopicHierarchy = {
  topic: { id: number; name: string; slug: string } | null;
  section: { name: string; slug: string } | null;
  exam: { name: string; slug: string } | null;
};

type AdaptiveDeck = {
  id: number;
  title: string;
  slug: string;
  tag_logic: 'ANY' | 'ALL';
  include_difficulties: string[] | null;
  batch_size: number;
  max_questions_per_session: number | null;
  rule_policy: string | null;
  keep_groups_together: boolean;
  tags?: Array<{ id: number }>;
  exclusions?: Array<{ id: number }>;
  topic?: TopicEntity;
};

type StructuredDeck = {
  id: number;
  title: string;
  slug: string;
  tag_logic: 'ANY' | 'ALL';
  ordered_items?: Array<{ kind: 'question' | 'group'; id: number }>;
  keep_groups_together: boolean;
  tags?: Array<{ id: number }>;
  exclusions?: Array<{ id: number }>;
  topic?: TopicEntity;
};

type TopicEntity = {
  id: number;
  name: string;
  display_name?: string;
  slug?: string;
  section?: {
    id: number;
    name: string;
    display_name?: string;
    slug?: string;
    exam?: {
      id: number;
      name: string;
      slug?: string;
    };
  };
};

type QuestionIndexEntry = {
  id: number;
  difficulty: string;
  group_id: string | null;
  tag_ids: number[];
};

type QuestionEntity = {
  id: number;
  question: string;
  explanation?: string | null;
  type: string;
  difficulty: string;
  group_id?: string | null;
  stimulus?: string | null;
  options?: Array<{ id: number; text: string; is_correct: boolean }>;
  tags?: Array<{ id: number; name: string }>;
};

const slugify = (value?: string | null) => {
  if (!value) {
    return null;
  }

  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};

const parseCsvParam = (value: unknown) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(','))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseIdsParam = (value: unknown) => {
  const parsed = parseCsvParam(value)
    .map((item) => Number(item))
    .filter((num) => Number.isInteger(num) && num > 0);

  return Array.from(new Set(parsed));
};

const setCacheHeaders = (ctx: any) => {
  ctx.set('Cache-Control', CACHE_HEADER);
};

const getServerSecret = () => strapi.config.get('server.quizApiSecret') ?? process.env.QUIZ_API_SECRET;

const buildTagFilter = (tagIds: number[], logic: 'ANY' | 'ALL') => {
  if (!tagIds.length) {
    return {};
  }

  if (logic === 'ALL') {
    return {
      $and: tagIds.map((id) => ({ tags: { id } }))
    };
  }

  return { tags: { id: { $in: tagIds } } };
};

const excludeTagsFilter = (tagIds: number[]) =>
  tagIds.length
    ? {
        tags: {
          id: {
            $notIn: tagIds
          }
        }
      }
    : {};

const extractHierarchy = (topic?: TopicEntity): TopicHierarchy => {
  if (!topic) {
    return { topic: null, section: null, exam: null };
  }

  const section = topic.section ?? null;
  const exam = section?.exam ?? null;

  return {
    topic: {
      id: Number(topic.id),
      name: topic.display_name ?? topic.name,
      slug: topic.slug ?? slugify(topic.name) ?? topic.name
    },
    section: section
      ? {
          name: section.display_name ?? section.name,
          slug: section.slug ?? slugify(section.name) ?? section.name
        }
      : null,
    exam: exam
      ? {
          name: exam.name,
          slug: exam.slug ?? slugify(exam.name) ?? exam.name
        }
      : null
  };
};

const fetchAdaptiveDeck = async (slug: string): Promise<AdaptiveDeck | null> => {
  const decks = await strapi.entityService.findMany(ADAPTIVE_UID, {
    filters: {
      slug: { $eq: slug },
      visibility: { $eq: 'public' }
    },
    fields: [
      'id',
      'title',
      'slug',
      'tag_logic',
      'include_difficulties',
      'batch_size',
      'max_questions_per_session',
      'rule_policy',
      'keep_groups_together'
    ],
    populate: {
      tags: { fields: ['id'] },
      exclusions: { fields: ['id'] },
      topic: {
        fields: ['id', 'name', 'display_name', 'slug'],
        populate: {
          section: {
            fields: ['id', 'name', 'display_name', 'slug'],
            populate: {
              exam: { fields: ['id', 'name', 'slug'] }
            }
          }
        }
      }
    },
    limit: 1
  });

  return (decks?.[0] ?? null) as AdaptiveDeck | null;
};

const fetchStructuredDeck = async (slug: string): Promise<StructuredDeck | null> => {
  const decks = await strapi.entityService.findMany(STRUCTURED_UID, {
    filters: {
      slug: { $eq: slug },
      visibility: { $eq: 'public' }
    },
    fields: ['id', 'title', 'slug', 'tag_logic', 'keep_groups_together'],
    populate: {
      tags: { fields: ['id'] },
      exclusions: { fields: ['id'] },
      ordered_items: true,
      topic: {
        fields: ['id', 'name', 'display_name', 'slug'],
        populate: {
          section: {
            fields: ['id', 'name', 'display_name', 'slug'],
            populate: {
              exam: { fields: ['id', 'name', 'slug'] }
            }
          }
        }
      }
    },
    limit: 1
  });

  return (decks?.[0] ?? null) as StructuredDeck | null;
};

const chunkedQuestionFetch = async (filters: any): Promise<QuestionIndexEntry[]> => {
  const results: QuestionIndexEntry[] = [];
  let page = 1;

  while (true) {
    const pageData = (await strapi.entityService.findMany(QUESTION_UID, {
      filters,
      fields: ['id', 'difficulty', 'group_id'],
      populate: {
        tags: { fields: ['id'] }
      },
      sort: { id: 'asc' },
      pagination: {
        page,
        pageSize: INDEX_PAGE_SIZE
      }
    })) as Array<{
      id: number;
      difficulty: string;
      group_id?: string | null;
      tags?: Array<{ id: number }>;
    }>;

    if (!pageData.length) {
      break;
    }

    for (const entry of pageData) {
      const tagIds = Array.isArray(entry.tags) ? entry.tags.map((tag) => Number(tag.id)) : [];

      results.push({
        id: Number(entry.id),
        difficulty: entry.difficulty,
        group_id: entry.group_id ?? null,
        tag_ids: tagIds
      });
    }

    if (pageData.length < INDEX_PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return results;
};

const fetchQuestionsByIds = async (ids: number[]): Promise<QuestionEntity[]> => {
  if (!ids.length) {
    return [];
  }

  const questions = (await strapi.entityService.findMany(QUESTION_UID, {
    filters: { id: { $in: ids } },
    fields: ['id', 'question', 'explanation', 'type', 'difficulty', 'group_id', 'stimulus'],
    populate: {
      options: true,
      tags: { fields: ['id', 'name'] }
    },
    sort: { id: 'asc' },
    limit: ids.length
  })) as QuestionEntity[];

  return questions;
};

const buildAdaptiveFilters = (deck: AdaptiveDeck) => {
  const difficulties = Array.isArray(deck.include_difficulties)
    ? Array.from(new Set(deck.include_difficulties.filter((value) => ALLOWED_DIFFICULTIES.includes(value))))
    : [];

  if (!difficulties.length) {
    throw new ValidationError('Adaptive deck is missing include_difficulties.');
  }

  const tagIds = Array.isArray(deck.tags) ? Array.from(new Set(deck.tags.map((tag) => Number(tag.id)))) : [];

  const exclusionIds = Array.isArray(deck.exclusions)
    ? Array.from(new Set(deck.exclusions.map((tag) => Number(tag.id))))
    : [];

  const filters: any = {
    difficulty: { $in: difficulties }
  };

  if (tagIds.length) {
    Object.assign(filters, buildTagFilter(tagIds, deck.tag_logic ?? 'ANY'));
  }

  if (exclusionIds.length) {
    const exclusionFilter = excludeTagsFilter(exclusionIds);
    if (Object.keys(exclusionFilter).length) {
      filters.$and = Array.isArray(filters.$and) ? filters.$and : [];
      filters.$and.push(exclusionFilter);
    }
  }

  return { filters, difficulties, tagIds, exclusionIds };
};

const buildStructuredQuestionOrder = async (deck: StructuredDeck) => {
  const ordered = Array.isArray(deck.ordered_items) ? deck.ordered_items : [];
  if (!ordered.length) {
    return [];
  }

  const groupAnchors = ordered.filter((item) => item.kind === 'group').map((item) => item.id);

  const anchorQuestions = groupAnchors.length ? await fetchQuestionsByIds(groupAnchors) : [];
  const groupIdByAnchor = new Map<number, string>();
  const groupIds = new Set<string>();

  for (const question of anchorQuestions) {
    if (question.group_id) {
      groupIdByAnchor.set(Number(question.id), question.group_id);
      groupIds.add(question.group_id);
    }
  }

  const groupedQuestions = new Map<string, number[]>();
  if (groupIds.size) {
    const members = await chunkedQuestionFetch({
      group_id: { $in: Array.from(groupIds) }
    });

    for (const entry of members) {
      if (!entry.group_id) continue;
      if (!groupedQuestions.has(entry.group_id)) {
        groupedQuestions.set(entry.group_id, []);
      }
      groupedQuestions.get(entry.group_id)!.push(entry.id);
    }
  }

  const resolved: number[] = [];

  for (const item of ordered) {
    if (item.kind === 'question') {
      resolved.push(item.id);
    } else {
      const groupId = groupIdByAnchor.get(item.id);
      if (groupId && groupedQuestions.has(groupId)) {
        resolved.push(...groupedQuestions.get(groupId)!);
      } else {
        resolved.push(item.id);
      }
    }
  }

  return Array.from(new Set(resolved));
};

const buildDeckMetadata = (variant: 'adaptive' | 'structured', deck: AdaptiveDeck | StructuredDeck) => {
  const { topic, section, exam } = extractHierarchy(deck.topic);

  const tags = Array.isArray(deck.tags) ? Array.from(new Set(deck.tags.map((tag) => Number(tag.id)))) : [];

  const exclusions = Array.isArray(deck.exclusions)
    ? Array.from(new Set(deck.exclusions.map((tag) => Number(tag.id))))
    : [];

  if (variant === 'adaptive') {
    const adaptiveDeck = deck as AdaptiveDeck;
    return {
      id: adaptiveDeck.id,
      slug: adaptiveDeck.slug,
      title: adaptiveDeck.title,
      variant,
      batch_size: adaptiveDeck.batch_size,
      max_questions_per_session: adaptiveDeck.max_questions_per_session ?? adaptiveDeck.batch_size,
      keep_groups_together: adaptiveDeck.keep_groups_together ?? false,
      rule_policy: adaptiveDeck.rule_policy ?? 'default-v1',
      exam,
      section,
      topic,
      tags,
      tag_logic: adaptiveDeck.tag_logic ?? 'ANY',
      include_difficulties: Array.isArray(adaptiveDeck.include_difficulties)
        ? adaptiveDeck.include_difficulties
        : [...ALLOWED_DIFFICULTIES],
      exclusions
    };
  }

  const structuredDeck = deck as StructuredDeck;
  return {
    id: structuredDeck.id,
    slug: structuredDeck.slug,
    title: structuredDeck.title,
    variant,
    batch_size: null,
    max_questions_per_session: null,
    keep_groups_together: structuredDeck.keep_groups_together ?? false,
    rule_policy: null,
    exam,
    section,
    topic,
    tags,
    tag_logic: structuredDeck.tag_logic ?? 'ANY',
    include_difficulties: [],
    exclusions
  };
};

export default {
  async index(ctx: any) {
    const deckSlug = ctx.query.deckSlug ? String(ctx.query.deckSlug).trim() : '';

    if (!deckSlug) {
      return ctx.badRequest('deckSlug query parameter is required.');
    }

    let variant: 'adaptive' | 'structured';
    let metadata: ReturnType<typeof buildDeckMetadata>;
    let questions: QuestionIndexEntry[] = [];

    const adaptiveDeck = await fetchAdaptiveDeck(deckSlug);
    if (adaptiveDeck) {
      variant = 'adaptive';
      metadata = buildDeckMetadata(variant, adaptiveDeck);

      const adaptiveFilters = buildAdaptiveFilters(adaptiveDeck);
      metadata.include_difficulties = adaptiveFilters.difficulties;
      metadata.tags = adaptiveFilters.tagIds;
      metadata.exclusions = adaptiveFilters.exclusionIds;
      questions = await chunkedQuestionFetch(adaptiveFilters.filters);
    } else {
      const structuredDeck = await fetchStructuredDeck(deckSlug);
      if (!structuredDeck) {
        return ctx.notFound('Deck not found.');
      }

      variant = 'structured';
      metadata = buildDeckMetadata(variant, structuredDeck);
      metadata.include_difficulties = [];
      const orderedIds = await buildStructuredQuestionOrder(structuredDeck);
      if (orderedIds.length) {
        const detailed = await fetchQuestionsByIds(orderedIds);
        const lookup = new Map<number, QuestionEntity>(detailed.map((question) => [Number(question.id), question]));
        questions = orderedIds
          .map((id) => lookup.get(id))
          .filter((question): question is QuestionEntity => Boolean(question))
          .map((question) => ({
            id: Number(question.id),
            difficulty: question.difficulty,
            group_id: question.group_id ?? null,
            tag_ids: Array.isArray(question.tags) ? question.tags.map((tag) => Number(tag.id)) : []
          }));
      } else {
        questions = [];
      }
    }

    setCacheHeaders(ctx);
    ctx.body = {
      deck: metadata,
      questions
    };
  },

  async fetchByIds(ctx: any) {
    const ids = parseIdsParam(ctx.query.ids);

    if (!ids.length) {
      return ctx.badRequest('ids query parameter is required.');
    }

    if (ids.length > MAX_IDS_PER_REQUEST) {
      return ctx.badRequest(`A maximum of ${MAX_IDS_PER_REQUEST} ids can be requested.`);
    }

    const includeAnswers = String(ctx.query.includeAnswers ?? '').toLowerCase() === 'true';
    const secretHeader = ctx.request.headers['x-quiz-secret'];
    const requestSecret = Array.isArray(secretHeader) ? secretHeader[0] : secretHeader;
    const serverSecret = getServerSecret();
    const canRevealAnswers = includeAnswers && serverSecret && requestSecret === serverSecret;

    const questions = await fetchQuestionsByIds(ids);
    const questionMap = new Map<number, QuestionEntity>(questions.map((question) => [Number(question.id), question]));

    const payload = ids
      .map((id) => questionMap.get(id))
      .filter((question): question is QuestionEntity => Boolean(question))
      .map((question) => ({
        id: Number(question.id),
        type: question.type,
        difficulty: question.difficulty,
        group_id: question.group_id ?? null,
        stem: question.question,
        explanation: question.explanation ?? null,
        stimulus: question.stimulus ?? null,
        options: Array.isArray(question.options)
          ? question.options.map((option) => ({
              id: option.id,
              text: option.text,
              ...(canRevealAnswers ? { is_correct: option.is_correct } : {})
            }))
          : [],
        tags: Array.isArray(question.tags)
          ? question.tags.map((tag) => ({
              id: Number(tag.id),
              name: tag.name
            }))
          : []
      }));

    setCacheHeaders(ctx);
    ctx.set('X-Total-Count', String(payload.length));
    ctx.body = payload;
  }
};
