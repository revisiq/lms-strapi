export default {
  routes: [
    {
      method: 'GET',
      path: '/adaptive-quizzes/:slug',
      handler: 'adaptive-quiz.findBySlug',
      config: {
        auth: false
      }
    }
  ]
};
