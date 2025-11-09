import { errors } from '@strapi/utils';

declare const strapi: any;

const { ValidationError } = errors;

const QUESTION_UID = 'api::question.question';

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

  if (event.state.existingQuestion) {
    return event.state.existingQuestion;
  }

  const existing = await strapi.entityService.findOne(QUESTION_UID, id, {
    populate: { options: true }
  });

  event.state.existingQuestion = existing;
  return existing;
};

const resolveArray = (value: any) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === 'object') {
    if (Array.isArray(value.set)) {
      return value.set;
    }

    if (Array.isArray(value.value)) {
      return value.value;
    }
  }

  return undefined;
};

const normalizeOptions = (options: any[]) =>
  options.map((option) => {
    if (!option || typeof option !== 'object') {
      throw new ValidationError('Each option must be an object.');
    }

    const text = typeof option.text === 'string' ? option.text.trim() : undefined;

    if (!text) {
      throw new ValidationError('Option text is required.');
    }

    const isCorrect =
      typeof option.is_correct === 'boolean'
        ? option.is_correct
        : option.is_correct === 'true'
          ? true
          : option.is_correct === '1';

    return {
      ...option,
      text,
      is_correct: Boolean(isCorrect)
    };
  });

const ensureQuestionValidity = async (event: any) => {
  const data = event?.params?.data ?? {};
  const existing = await fetchExisting(event);

  const type = data.type ?? existing?.type ?? 'MCQ';
  data.type = type;

  const difficulty = data.difficulty ?? existing?.difficulty;

  if (!difficulty) {
    throw new ValidationError('Difficulty is required for questions.');
  }

  data.difficulty = difficulty;

  if (typeof data.group_id === 'string') {
    data.group_id = data.group_id.trim() || null;
  }

  if (type === 'MCQ') {
    const rawOptions = resolveArray(data.options) ?? resolveArray(existing?.options) ?? [];

    if (rawOptions.length < 2) {
      throw new ValidationError('MCQ questions must include at least two options.');
    }

    const normalizedOptions = normalizeOptions(rawOptions);
    const correctCount = normalizedOptions.filter((option) => option.is_correct).length;

    if (correctCount === 0) {
      throw new ValidationError('MCQ questions must have at least one correct option.');
    }

    data.options = normalizedOptions;

    if (data.answer !== undefined) {
      delete data.answer;
    }
  } else if (data.options !== undefined) {
    // For non-MCQ types, clear options if provided.
    delete data.options;
  }

  if (type !== 'MCQ') {
    const answer =
      typeof data.answer === 'string'
        ? data.answer
        : typeof existing?.answer === 'string'
          ? existing.answer
          : undefined;

    if (!answer || !answer.trim()) {
      throw new ValidationError('Answer is required for non-MCQ question types.');
    }

    data.answer = answer.trim();
  }
};

export default {
  async beforeCreate(event: any) {
    await ensureQuestionValidity(event);
  },
  async beforeUpdate(event: any) {
    await ensureQuestionValidity(event);
  }
};
