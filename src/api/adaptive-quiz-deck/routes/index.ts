export default {
  routes: [
    {
      method: 'GET',
      path: '/adaptive-quiz-decks/:documentId/index',
      handler: 'adaptive-quiz-deck.getQuestionIndex',
      config: {
        auth: false
      }
    }
  ]
};


