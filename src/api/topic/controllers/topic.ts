/**
 * topic controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::topic.topic', () => ({
  // Override find to filter invisible decks from results
  async find(ctx) {
    const response = await super.find(ctx);

    // Filter invisible decks from each topic
    if (response?.data) {
      response.data = response.data.map(filterInvisibleDecksFromTopic);
    }

    return response;
  },

  // Override findOne to filter invisible decks from result
  async findOne(ctx) {
    const response = await super.findOne(ctx);

    if (response?.data) {
      response.data = filterInvisibleDecksFromTopic(response.data);
    }

    return response;
  }
}));

/**
 * Filters out decks/quiz decks with visible: false from a topic's relations
 */
function filterInvisibleDecksFromTopic(topic: any): any {
  if (!topic?.attributes) {
    return topic;
  }

  const result = { ...topic, attributes: { ...topic.attributes } };

  // Filter decks
  if (result.attributes.decks?.data) {
    result.attributes.decks = {
      ...result.attributes.decks,
      data: result.attributes.decks.data.filter(
        (deck: any) => deck?.attributes?.visible === true
      )
    };
  }

  // Filter adaptive_quiz_decks
  if (result.attributes.adaptive_quiz_decks?.data) {
    result.attributes.adaptive_quiz_decks = {
      ...result.attributes.adaptive_quiz_decks,
      data: result.attributes.adaptive_quiz_decks.data.filter(
        (deck: any) => deck?.attributes?.visible === true
      )
    };
  }

  // Filter structured_quiz_decks
  if (result.attributes.structured_quiz_decks?.data) {
    result.attributes.structured_quiz_decks = {
      ...result.attributes.structured_quiz_decks,
      data: result.attributes.structured_quiz_decks.data.filter(
        (deck: any) => deck?.attributes?.visible === true
      )
    };
  }

  return result;
}
