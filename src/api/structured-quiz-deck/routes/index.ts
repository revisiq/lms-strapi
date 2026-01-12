export default {
  routes: [
    {
      method: 'GET',
      path: '/structured-quiz-decks/:documentId/index',
      handler: 'structured-quiz-deck.getQuestionIndex',
      config: {
        auth: false
      }
    }
  ]
};
