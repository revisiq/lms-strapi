/**
 * exam controller
 */

import { factories } from '@strapi/strapi';

const EXAM_UID = 'api::exam.exam';
const SECTION_UID = 'api::section.section';
const TOPIC_UID = 'api::topic.topic';

const slugifySegment = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

const assignOptionalScalars = (target: Record<string, unknown>, raw: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const v = raw[key];
    if (v !== undefined && v !== null && v !== '') {
      target[key] = typeof v === 'boolean' || typeof v === 'number' ? v : String(v);
    }
  }
};

export type BulkExamNestedResponse = {
  exam: { id: string; slug: string };
  sections: Array<{
    id: string;
    slug: string;
    topics: Array<{ id: string; slug: string }>;
  }>;
};

function parsePayload(body: unknown): { exam: Record<string, unknown>; sections: Record<string, unknown>[] } {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body must be a JSON object');
  }
  const b = body as Record<string, unknown>;
  const root = b.data !== undefined && typeof b.data === 'object' && b.data !== null ? (b.data as Record<string, unknown>) : b;
  const exam = root.exam;
  if (!exam || typeof exam !== 'object') {
    throw new Error('Payload must include an "exam" object');
  }
  const sectionsRaw = root.sections;
  const sections = Array.isArray(sectionsRaw) ? sectionsRaw : [];
  if (!Array.isArray(sectionsRaw) && sectionsRaw !== undefined) {
    throw new Error('"sections" must be an array when provided');
  }
  return { exam: exam as Record<string, unknown>, sections: sections as Record<string, unknown>[] };
}

function buildExamCreateData(raw: Record<string, unknown>): Record<string, unknown> {
  const displayName = raw.display_name;
  if (typeof displayName !== 'string' || !displayName.trim()) {
    throw new Error('exam.display_name is required');
  }
  const trimmedName = displayName.trim();
  let slug: string;
  if (typeof raw.slug === 'string' && raw.slug.trim()) {
    slug = raw.slug.trim();
  } else {
    slug = slugifySegment(trimmedName);
    if (!slug) {
      throw new Error('exam.slug is required if display_name cannot produce a valid slug');
    }
  }
  const data: Record<string, unknown> = {
    display_name: trimmedName,
    slug,
    display_order: typeof raw.display_order === 'number' && Number.isFinite(raw.display_order) ? raw.display_order : 0
  };
  assignOptionalScalars(data, raw, ['blurb', 'shortDescription', 'description']);
  return data;
}

/**
 * Strapi v5 (draft & publish): link many-to-one via parent documentId.
 * Plain numeric `id` on create often does not persist the FK; REST uses documentId string.
 */
function relationDocumentRef(parent: { documentId?: string; id?: number | string }): string {
  const ref = parent.documentId ?? parent.id;
  if (ref === undefined || ref === null) {
    throw new Error('Parent entity missing documentId and id for relation');
  }
  return String(ref);
}

async function withDocumentId(
  strapi: any,
  uid: string,
  entity: { id?: number | string; documentId?: string }
): Promise<{ id?: number | string; documentId?: string }> {
  if (entity.documentId != null && entity.documentId !== '') {
    return entity;
  }
  if (entity.id == null) {
    return entity;
  }
  const full = await strapi.entityService.findOne(uid, entity.id, {
    fields: ['id', 'documentId']
  });
  return full ?? entity;
}

function buildSectionCreateData(
  raw: Record<string, unknown>,
  examEntity: { documentId?: string; id?: number | string },
  fallbackOrder: number
): Record<string, unknown> {
  const displayName = raw.display_name;
  if (typeof displayName !== 'string' || !displayName.trim()) {
    throw new Error('Each section requires display_name');
  }
  const slug = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : '';
  if (!slug) {
    throw new Error('Each section requires slug');
  }
  const data: Record<string, unknown> = {
    display_name: displayName.trim(),
    slug,
    exam: relationDocumentRef(examEntity),
    is_visible: typeof raw.is_visible === 'boolean' ? raw.is_visible : false,
    display_order:
      typeof raw.display_order === 'number' && Number.isFinite(raw.display_order) ? raw.display_order : fallbackOrder
  };
  assignOptionalScalars(data, raw, ['blurb', 'shortDescription', 'description']);
  return data;
}

function buildTopicCreateData(
  raw: Record<string, unknown>,
  sectionEntity: { documentId?: string; id?: number | string },
  fallbackOrder: number
): Record<string, unknown> {
  const displayName = raw.display_name;
  if (typeof displayName !== 'string' || !displayName.trim()) {
    throw new Error('Each topic requires display_name');
  }
  const slug = typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : '';
  if (!slug) {
    throw new Error('Each topic requires slug');
  }
  const data: Record<string, unknown> = {
    display_name: displayName.trim(),
    slug,
    section: relationDocumentRef(sectionEntity),
    display_order:
      typeof raw.display_order === 'number' && Number.isFinite(raw.display_order) ? raw.display_order : fallbackOrder
  };
  assignOptionalScalars(data, raw, ['blurb', 'shortDescription', 'description']);
  return data;
}

export default factories.createCoreController(EXAM_UID, ({ strapi }) => ({
  async findBySlug(ctx) {
    const slug = ctx.params?.slug?.trim();

    if (!slug) {
      return ctx.badRequest('slug parameter is required.');
    }

    const [exam] = await strapi.entityService.findMany(EXAM_UID, {
      filters: {
        slug: { $eq: slug }
      },
      populate: {
        sections: {
          sort: { display_order: 'asc' },
          populate: {
            topics: {
              sort: { display_order: 'asc' }
            }
          }
        }
      },
      limit: 1
    });

    if (!exam) {
      return ctx.notFound('Exam not found.');
    }

    ctx.set('Cache-Control', 'public, max-age=60');
    return this.transformResponse(exam);
  },

  async findOne(ctx) {
    const slug = ctx.params?.id?.trim();

    if (!slug) {
      return ctx.badRequest('Slug parameter is required.');
    }

    const [exam] = await strapi.entityService.findMany(EXAM_UID, {
      filters: {
        slug: { $eq: slug }
      },
      populate: {
        sections: {
          sort: { display_order: 'asc' },
          populate: {
            topics: {
              sort: { display_order: 'asc' }
            }
          }
        }
      },
      limit: 1
    });

    if (!exam) {
      return ctx.notFound('Exam not found.');
    }

    ctx.set('Cache-Control', 'public, max-age=60');
    return this.transformResponse(exam);
  },

  async bulkCreateNested(ctx) {
    try {
      const { exam: examRaw, sections: sectionsRaw } = parsePayload(ctx.request.body);

      const result = await strapi.db.transaction(async () => {
        const createdExam = await strapi.entityService.create(EXAM_UID, {
          data: buildExamCreateData(examRaw) as any
        });
        const examForRelations = await withDocumentId(strapi, EXAM_UID, createdExam as any);

        const sectionsOut: BulkExamNestedResponse['sections'] = [];

        for (let si = 0; si < sectionsRaw.length; si += 1) {
          const sec = sectionsRaw[si];
          if (!sec || typeof sec !== 'object') {
            throw new Error(`sections[${si}] must be an object`);
          }
          const secObj = sec as Record<string, unknown>;
          const createdSection = await strapi.entityService.create(SECTION_UID, {
            data: buildSectionCreateData(secObj, examForRelations as any, si) as any
          });
          const sectionForRelations = await withDocumentId(strapi, SECTION_UID, createdSection as any);

          const topicsRaw = Array.isArray(secObj.topics) ? secObj.topics : [];
          if (!Array.isArray(secObj.topics) && secObj.topics !== undefined) {
            throw new Error(`sections[${si}].topics must be an array when provided`);
          }

          const topicsOut: Array<{ id: string; slug: string }> = [];

          for (let ti = 0; ti < topicsRaw.length; ti += 1) {
            const topic = topicsRaw[ti];
            if (!topic || typeof topic !== 'object') {
              throw new Error(`sections[${si}].topics[${ti}] must be an object`);
            }
            const createdTopic = await strapi.entityService.create(TOPIC_UID, {
              data: buildTopicCreateData(topic as Record<string, unknown>, sectionForRelations as any, ti) as any
            });
            topicsOut.push({
              id: String(createdTopic.id),
              slug: String((createdTopic as any).slug ?? '')
            });
          }

          sectionsOut.push({
            id: String(createdSection.id),
            slug: String((createdSection as any).slug ?? ''),
            topics: topicsOut
          });
        }

        return {
          exam: {
            id: String(createdExam.id),
            slug: String((createdExam as any).slug ?? '')
          },
          sections: sectionsOut
        };
      });

      ctx.body = result;
    } catch (err: any) {
      return ctx.badRequest(err.message || 'Bulk exam create failed');
    }
  }
}));
