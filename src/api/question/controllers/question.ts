// src/api/question/controllers/question.ts

import { factories } from '@strapi/strapi';

const QUESTION_UID = 'api::question.question';

export type BulkQuestionResult = {
  id?: string;
  status: 'ok' | 'skipped' | 'error';
  message?: string;
  question?: string;
  reason?: string;
};

function unwrapBulkItems(items: any[]): any[] {
  return items.map((item: any) => {
    if (item && typeof item === 'object' && 'data' in item) {
      return item.data;
    }
    return item;
  });
}

const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

function parseQuestionId(item: any): { id: number } | { reason: 'missing_id' | 'invalid_id' } {
  if (!item || typeof item !== 'object' || !('id' in item)) {
    return { reason: 'missing_id' };
  }
  const raw = item.id;
  if (raw === null || raw === undefined || raw === '') {
    return { reason: 'missing_id' };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    return { reason: 'invalid_id' };
  }
  return { id: n };
}

function itemTagIds(item: any, nameToId: Record<string, string>): string[] {
  if (!Array.isArray(item.tags)) {
    return [];
  }
  return item.tags
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

function itemDeckIds(item: any): string[] {
  if (!Array.isArray(item.decks)) {
    return [];
  }
  return item.decks
    .map((deck: number | string) => String(deck))
    .filter((id: string) => id && !isNaN(Number(id)));
}

async function resolveTagNameToIdsForBulk(strapi: any, items: any[]): Promise<Record<string, string>> {
  const slugToDisplay: Record<string, string> = {};
  const slugSet = new Set<string>();

  for (const item of items) {
    if (!item || typeof item !== 'object' || !Array.isArray(item.tags)) {
      continue;
    }
    for (const raw of item.tags) {
      if (typeof raw === 'string') {
        const slug = slugify(raw);
        slugSet.add(slug);
        slugToDisplay[slug] = raw;
      }
    }
  }

  const allSlugs = Array.from(slugSet);
  const nameToId: Record<string, string> = {};

  if (allSlugs.length === 0) {
    return nameToId;
  }

  const existing = await strapi.documents('api::tag.tag').findMany({
    filters: { name: { $in: allSlugs } },
    select: ['id', 'name']
  });

  existing.forEach((t: any) => {
    nameToId[t.name] = String(t.id);
  });

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

  return nameToId;
}

function buildCreateQuestionData(item: any, nameToId: Record<string, string>) {
  const questionType = item.type || 'MCQ';
  const questionData: any = {
    question: item.question,
    type: questionType,
    difficulty: item.difficulty || 'medium'
  };

  if (questionType === 'MCQ') {
    if (!Array.isArray(item.options) || item.options.length === 0) {
      throw new Error(`MCQ questions must include at least one option. Question: ${item.question || 'Unknown'}`);
    }

    if (item.options.length < 2) {
      throw new Error(`MCQ questions must include at least two options. Question: ${item.question || 'Unknown'}`);
    }

    questionData.options = item.options;
  }

  if (item.explanation !== undefined && item.explanation !== null) {
    questionData.explanation = String(item.explanation);
  }

  if (item.hint !== undefined && item.hint !== null) {
    questionData.hint = String(item.hint);
  }

  if (item.example !== undefined && item.example !== null) {
    questionData.example = String(item.example);
  }

  let questionGroupId: number | null = null;
  if (item.question_group !== undefined && item.question_group !== null) {
    const groupId = Number(item.question_group);
    if (!isNaN(groupId) && groupId > 0) {
      questionGroupId = groupId;
    }
  }

  const tagIds = itemTagIds(item, nameToId);
  const deckIds = itemDeckIds(item);

  return {
    ...questionData,
    ...(tagIds.length > 0 && { tags: tagIds }),
    ...(deckIds.length > 0 && { decks: deckIds }),
    ...(questionGroupId && { question_group: questionGroupId })
  };
}

function buildPatchFromItem(item: any, nameToId: Record<string, string>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const key of Object.keys(item)) {
    if (key === 'id') {
      continue;
    }

    switch (key) {
      case 'question':
        patch.question = item.question;
        break;
      case 'type':
        patch.type = item.type;
        break;
      case 'difficulty':
        patch.difficulty = item.difficulty;
        break;
      case 'options':
        patch.options = item.options;
        break;
      case 'explanation':
        patch.explanation =
          item.explanation === null || item.explanation === undefined
            ? item.explanation
            : String(item.explanation);
        break;
      case 'hint':
        patch.hint =
          item.hint === null || item.hint === undefined ? item.hint : String(item.hint);
        break;
      case 'example':
        patch.example =
          item.example === null || item.example === undefined ? item.example : String(item.example);
        break;
      case 'answer':
        patch.answer =
          item.answer === null || item.answer === undefined ? item.answer : String(item.answer);
        break;
      case 'tags':
        patch.tags = itemTagIds(item, nameToId);
        break;
      case 'decks':
        patch.decks = itemDeckIds(item);
        break;
      case 'question_group': {
        const qg = item.question_group;
        if (qg === null || qg === undefined || qg === '') {
          patch.question_group = null;
        } else {
          const groupId = Number(qg);
          if (!isNaN(groupId) && groupId > 0) {
            patch.question_group = groupId;
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return patch;
}

export default factories.createCoreController(QUESTION_UID, ({ strapi }) => ({
  async bulkCreate(ctx) {
    let items = ctx.request.body;

    if (!Array.isArray(items)) {
      return ctx.badRequest('Request body must be an array of question objects');
    }

    items = unwrapBulkItems(items);

    const nameToId = await resolveTagNameToIdsForBulk(strapi, items);

    const results: BulkQuestionResult[] = [];

    for (const item of items) {
      try {
        const questionData = buildCreateQuestionData(item, nameToId);
        const q = await strapi.entityService.create(QUESTION_UID, {
          data: questionData
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
  },

  async bulkEdit(ctx) {
    let items = ctx.request.body;

    if (!Array.isArray(items)) {
      return ctx.badRequest('Request body must be an array of question objects');
    }

    items = unwrapBulkItems(items);

    const needsTags = items.some(
      (item) => item && typeof item === 'object' && 'tags' in item && Array.isArray(item.tags)
    );
    const nameToId = needsTags ? await resolveTagNameToIdsForBulk(strapi, items) : {};

    const results: BulkQuestionResult[] = [];

    for (const item of items) {
      const parsed = parseQuestionId(item);
      if ('reason' in parsed) {
        results.push({
          status: 'skipped',
          reason: parsed.reason,
          question: item?.question
        });
        continue;
      }

      const id = parsed.id;
      const existing = await strapi.entityService.findOne(QUESTION_UID, id);
      if (!existing) {
        results.push({
          status: 'skipped',
          reason: 'not_found',
          id: String(id),
          question: item?.question
        });
        continue;
      }

      try {
        const patch = buildPatchFromItem(item, nameToId);
        const updated = await strapi.entityService.update(QUESTION_UID, id, {
          data: patch as any
        });

        results.push({ id: String(updated.id), status: 'ok' });
      } catch (err: any) {
        results.push({
          id: String(id),
          status: 'error',
          message: err.message || 'Unknown error occurred',
          question: item?.question || 'Unknown question'
        });
      }
    }

    ctx.body = results;
  }
}));
