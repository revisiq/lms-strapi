export default {
  routes: [
    {
      method: 'GET',
      path: '/quiz/index',
      handler: 'quiz.index',
      config: {
        auth: false
      }
    },
    {
      method: 'GET',
      path: '/quiz/questions',
      handler: 'quiz.fetchByIds',
      config: {
        auth: false
      }
    }
  ]
};
