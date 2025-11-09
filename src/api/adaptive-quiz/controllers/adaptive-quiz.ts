import { factories } from '@strapi/strapi';

declare const strapi: any;

const ADAPTIVE_UID = 'api::adaptive-quiz-deck.adaptive-quiz-deck';

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

const extractHierarchy = (topic: any) => {
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

export default factories.createCoreController(ADAPTIVE_UID, ({ strapi }) => ({
  async findBySlug(ctx) {
    const slug = ctx.params?.slug?.trim();

    if (!slug) {
      return ctx.badRequest('slug parameter is required.');
    }

    const [entry] = (await strapi.entityService.findMany(ADAPTIVE_UID, {
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
      populate: ['tags', 'exclusions', 'topic', 'topic.section', 'topic.section.exam'],
      limit: 1
    })) as any[];

    if (!entry) {
      return ctx.notFound('Adaptive quiz deck not found.');
    }

    const { topic, section, exam } = extractHierarchy(entry.topic);
    const tagIds = Array.isArray(entry.tags)
      ? entry.tags.map((tag: any) => Number(tag.id))
      : [];
    const exclusionIds = Array.isArray(entry.exclusions)
      ? entry.exclusions.map((tag: any) => Number(tag.id))
      : [];

    ctx.set('Cache-Control', 'public, max-age=60');
    ctx.body = {
      id: entry.id,
      slug: entry.slug,
      title: entry.title,
      variant: 'adaptive',
      batch_size: entry.batch_size,
      max_questions_per_session: entry.max_questions_per_session ?? entry.batch_size,
      keep_groups_together: entry.keep_groups_together ?? false,
      rule_policy: entry.rule_policy ?? 'default-v1',
      exam,
      section,
      topic,
      tags: tagIds,
      tag_logic: entry.tag_logic ?? 'ANY',
      include_difficulties: Array.isArray(entry.include_difficulties)
        ? entry.include_difficulties
        : [],
      exclusions: exclusionIds
    };
  }
}));
