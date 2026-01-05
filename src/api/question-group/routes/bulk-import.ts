export default {
  routes: [
    {
      method: 'POST',
      path: '/question-groups/bulk',
      handler: 'question-group.bulkCreate',
      config: {
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/question-groups/with-questions',
      handler: 'question-group.createWithQuestions',
      config: {
        auth: false
      }
    }
  ]
};
