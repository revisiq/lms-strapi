export default {
  routes: [
    {
      method: 'GET',
      path: '/exams/:slug',
      handler: 'exam.findBySlug',
      config: {
        auth: false
      }
    }
  ]
};
