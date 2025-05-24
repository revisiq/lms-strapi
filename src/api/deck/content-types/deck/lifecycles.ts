interface DeckRecord {
  documentId: string;
  offset?: number;
  limit?: number;
}

export default {
  /**
   * After creating a Deck, populate its `questions` relation
   * with only those Questions that have *all* of the Deck’s tags,
   * slicing by offset/limit and sorting by ID for stability.
   */
  async afterCreate(event) {
    const { documentId, offset = 0, limit = 50 } = event.result;

    // 1) Re-fetch the Deck so we can retrieve its full `tags` array
    const deck = await strapi.documents('api::deck.deck').findOne({
      documentId, // Deck’s unique ID
      populate: ['tags'] // bring in the tag objects
    });

    // 2) Extract all tag IDs
    const tagIds = deck.tags.map((tag) => tag.id);

    // 3) Build an `$and` filter so each Question must have *every* tag
    const allTagsFilter = tagIds.map((tagId) => ({
      tags: { id: { $eq: tagId } }
    }));

    // 4) Query Questions matching all tags, sorted & sliced
    const questions = await strapi.documents('api::question.question').findMany({
      where: { $and: allTagsFilter },
      orderBy: { id: 'ASC' }, // stable sort as pool grows
      offset,
      limit,
      select: ['id'] // only need IDs for linking
    });

    // 5) Link those Question IDs into the Deck
    const questionIds = questions.map((q) => q.id);
    await strapi.documents('api::deck.deck').update({
      documentId,
      data: { questions: questionIds }
    });
  }
};
