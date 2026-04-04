export default {
  routes: [
    {
      method: 'POST',
      path: '/questions/bulk',
      handler: 'question.bulkCreate',
      config: {
        auth: false // or true if you want it protected
      }
    },
    {
      method: 'POST',
      path: '/questions/bulk-edit',
      handler: 'question.bulkEdit',
      config: {
        auth: false
      }
    },
    {
      method: 'POST',
      path: '/questions/bulk-delete',
      handler: 'question.bulkDelete',
      config: {
        auth: false
      }
    }
  ]
};
