import { errors } from '@strapi/utils';

declare const strapi: any;

const { ValidationError } = errors;

const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];
const ADAPTIVE_UID = 'api::adaptive-quiz-deck.adaptive-quiz-deck';

const ensureArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    return value as string[];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed as string[];
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
      return candidate.set as string[];
    }
    if (Array.isArray(candidate.value)) {
      return candidate.value as string[];
    }
  }

  return undefined;
};

const ensureBatchSize = (data: any, existing: any) => {
  const raw = data.batch_size ?? existing?.batch_size ?? 5;

  if (!Number.isInteger(raw)) {
    throw new ValidationError('batch_size must be an integer.');
  }

  if (raw < 3 || raw > 10) {
    throw new ValidationError('batch_size must be between 3 and 10.');
  }

  data.batch_size = raw;
};

const ensureMaxQuestions = (data: any, existing: any) => {
  const base = data.max_questions_per_session ?? existing?.max_questions_per_session ?? 25;

  if (!Number.isInteger(base)) {
    throw new ValidationError('max_questions_per_session must be an integer.');
  }

  if (base < data.batch_size) {
    throw new ValidationError(
      'max_questions_per_session must be greater than or equal to batch_size.'
    );
  }

  data.max_questions_per_session = base;
};

const normalizeDifficulties = (data: any, existing: any) => {
  const raw =
    ensureArray(data.include_difficulties) ?? ensureArray(existing?.include_difficulties);

  const values = raw && raw.length ? raw : [...VALID_DIFFICULTIES];

  const normalized = values.map((item, index) => {
    if (typeof item !== 'string') {
      throw new ValidationError(
        `include_difficulties entry ${index + 1} must be a difficulty string.`
      );
    }

    const value = item.trim().toLowerCase();
    if (!VALID_DIFFICULTIES.includes(value)) {
      throw new ValidationError(`Invalid difficulty "${item}" in include_difficulties.`);
    }

    return value;
  });

  data.include_difficulties = Array.from(new Set(normalized));
};

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

  const existing = await strapi.entityService.findOne(ADAPTIVE_UID, id);
  event.state.existingDeck = existing;
  return existing;
};

const normalizeBaseFields = (data: any, existing: any) => {
  if (!data.visibility) {
    data.visibility = existing?.visibility ?? 'draft';
  }

  if (!data.tag_logic) {
    data.tag_logic = existing?.tag_logic ?? 'ANY';
  }

  ensureBatchSize(data, existing);
  ensureMaxQuestions(data, existing);
  normalizeDifficulties(data, existing);

  const rulePolicyRaw =
    typeof data.rule_policy === 'string'
      ? data.rule_policy
      : typeof existing?.rule_policy === 'string'
        ? existing.rule_policy
        : null;

  data.rule_policy =
    typeof rulePolicyRaw === 'string' && rulePolicyRaw.trim().length
      ? rulePolicyRaw.trim()
      : 'default-v1';
};

export default {
  async beforeCreate(event: any) {
    const data = event?.params?.data ?? {};
    normalizeBaseFields(data, null);
  },
  async beforeUpdate(event: any) {
    const data = event?.params?.data ?? {};
    const existing = await fetchExisting(event);
    normalizeBaseFields(data, existing);
  }
};
