import { errors } from '@strapi/utils';

declare const strapi;

const { ValidationError } = errors;

const slugifyValue = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const trimString = (data: Record<string, unknown>, key: string, lowerCase = false) => {
  const value = data[key];

  if (typeof value !== 'string') {
    return;
  }

  data[key] = lowerCase ? value.trim().toLowerCase() : value.trim();
};

const normalizeCoreFields = (data: Record<string, unknown>) => {
  if (!data) {
    return;
  }

  trimString(data, 'title');
  trimString(data, 'exam');
  trimString(data, 'section');
  trimString(data, 'topic');
  trimString(data, 'intro');
  trimString(data, 'parentHubUrl', true);
  trimString(data, 'canonicalUrl');

  const slugSource =
    typeof data.slug === 'string' && data.slug.trim().length > 0
      ? data.slug
      : typeof data.title === 'string'
        ? (data.title as string)
        : undefined;

  if (!slugSource) {
    throw new ValidationError('Slug is required for an MCQ set.');
  }

  const normalizedSlug = slugifyValue(slugSource);

  if (!normalizedSlug) {
    throw new ValidationError('Slug must contain alphanumeric characters.');
  }

  data.slug = normalizedSlug;
};

const getExistingEntry = async (event: any) => {
  if (event?.action !== 'beforeUpdate') {
    return null;
  }

  const entryId = event.params?.where?.id;

  if (!entryId) {
    return null;
  }

  if (!event.state) {
    event.state = {};
  }

  if (event.state.existingMcqSet) {
    return event.state.existingMcqSet;
  }

  const existing = await strapi.entityService.findOne('api::mcq-set.mcq-set', entryId, {
    fields: ['id', 'totalQuestions'],
    populate: {
      freeQuestions: true
    }
  });

  event.state.existingMcqSet = existing;
  return existing;
};

const ensureQuestionCounts = async (event: any) => {
  const data = event?.params?.data ?? {};
  let totalQuestions = typeof data.totalQuestions === 'number' ? data.totalQuestions : undefined;
  let freeCount = Array.isArray(data.freeQuestions) ? data.freeQuestions.length : undefined;

  if (event.action === 'beforeUpdate' && (!Number.isInteger(totalQuestions) || freeCount === undefined)) {
    const existing = await getExistingEntry(event);

    if (existing && !Number.isInteger(totalQuestions)) {
      totalQuestions = existing.totalQuestions;
    }

    if (existing && freeCount === undefined) {
      freeCount = Array.isArray(existing.freeQuestions) ? existing.freeQuestions.length : 0;
    }
  }

  if (!Number.isInteger(totalQuestions)) {
    return;
  }

  if (typeof freeCount !== 'number') {
    freeCount = 0;
  }

  if (freeCount > (totalQuestions as number)) {
    throw new ValidationError('Total questions cannot be less than the number of free MCQs attached to this set.');
  }
};

const normalizeFreeQuestions = (event: any) => {
  const data = event?.params?.data ?? {};
  const freeQuestions = Array.isArray(data.freeQuestions) ? data.freeQuestions : undefined;

  if (!freeQuestions) {
    return;
  }

  freeQuestions.forEach((question: any, questionIndex: number) => {
    if (!question || typeof question !== 'object') {
      return;
    }
  });
};

export default {
  async beforeCreate(event: any) {
    normalizeCoreFields(event?.params?.data ?? {});
    normalizeFreeQuestions(event);
    await ensureQuestionCounts(event);
  },
  async beforeUpdate(event: any) {
    normalizeCoreFields(event?.params?.data ?? {});
    normalizeFreeQuestions(event);
    await ensureQuestionCounts(event);
  }
};
