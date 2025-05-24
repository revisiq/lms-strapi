export default {
  routes: [
    {
      method: 'POST',
      path: '/questions/bulk',
      handler: 'question.bulkCreate',
      config: {
        auth: false // or true if you want it protected
      }
    }
  ]
};
