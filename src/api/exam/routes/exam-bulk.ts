export default {
  routes: [
    {
      method: 'POST',
      path: '/exams/bulk',
      handler: 'exam.bulkCreateNested',
      config: {
        auth: false
      }
    }
  ]
};
