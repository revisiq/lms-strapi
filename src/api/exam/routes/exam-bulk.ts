export default {
  routes: [
    {
      method: 'POST',
      // Avoid `/exams/bulk`: `GET /exams/:slug` / `:id` can claim that path and yield POST → 405.
      path: '/exams/bulk/create',
      handler: 'exam.bulkCreateNested',
      config: {
        auth: false
      }
    }
  ]
};
