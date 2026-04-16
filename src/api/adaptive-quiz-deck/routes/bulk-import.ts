export default {
  routes: [
    {
      method: 'POST',
      path: '/adaptive-quiz-decks/bulk',
      handler: 'adaptive-quiz-deck.bulkCreate',
      config: {
        auth: false
      }
    }
  ]
};

