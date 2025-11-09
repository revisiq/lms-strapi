import { errors } from '@strapi/utils';

declare const strapi: any;

const { ValidationError } = errors;

const ORDERED_ITEM_KINDS = ['question', 'group'];
const STRUCTURED_UID = 'api::structured-quiz-deck.structured-quiz-deck';

type OrderedItem = {
  kind: 'question' | 'group';
  id: number;
};

const ensureArray = (value: unknown) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      const segments = trimmed
        .split(',')
        .map((segment) => segment.trim())
        .filter(Boolean);
      if (segments.length) {
        return segments;
      }
    }
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (Array.isArray(candidate.set)) {
      return candidate.set;
    }

    if (Array.isArray(candidate.value)) {
      return candidate.value;
    }
  }

  return undefined;
};

const isPositiveInteger = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) > 0;

const fetchExisting = async (event: any) => {
  if (event.action !== 'beforeUpdate') {
    return null;
  }

  const id = event?.params?.where?.id;
  if (!id) {
    return null;
  }

  if (!event.state) {
    event.state = {};
  }

  if (event.state.existingDeck) {
    return event.state.existingDeck;
  }

  const existing = await strapi.entityService.findOne(STRUCTURED_UID, id, {
    populate: ['ordered_items']
  });
  event.state.existingDeck = existing;
  return existing;
};

const normalizeOrderedItems = (data: any, existing: any) => {
  const rawItems = ensureArray(data.ordered_items) ?? ensureArray(existing?.ordered_items);

  if (!rawItems || rawItems.length === 0) {
    throw new ValidationError('Structured decks must define ordered_items.');
  }

  const normalized: OrderedItem[] = rawItems.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new ValidationError(`ordered_items entry ${index + 1} must be an object.`);
    }

    const kind = (item as any).kind;
    const id = (item as any).id;

    if (!ORDERED_ITEM_KINDS.includes(kind)) {
      throw new ValidationError(`ordered_items entry ${index + 1} has invalid kind "${kind}".`);
    }

    if (!isPositiveInteger(id)) {
      throw new ValidationError(
        `ordered_items entry ${index + 1} must include a positive numeric id.`
      );
    }

    return { kind, id };
  });

  data.ordered_items = normalized;
};

const normalizeBaseFields = (data: any, existing: any) => {
  if (!data.visibility) {
    data.visibility = existing?.visibility ?? 'draft';
  }

  if (!data.tag_logic) {
    data.tag_logic = existing?.tag_logic ?? 'ANY';
  }

  delete data.include_difficulties;
  delete data.rule_policy;
  delete data.max_questions_per_session;
  delete data.batch_size;
};

export default {
  async beforeCreate(event: any) {
    const data = event?.params?.data ?? {};
    normalizeBaseFields(data, null);
    normalizeOrderedItems(data, null);
  },
  async beforeUpdate(event: any) {
    const data = event?.params?.data ?? {};
    const existing = await fetchExisting(event);
    normalizeBaseFields(data, existing);
    normalizeOrderedItems(data, existing);
  }
};
