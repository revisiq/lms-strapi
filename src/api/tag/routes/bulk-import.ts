export default {
  routes: [
    {
      method: 'POST',
      path: '/tags/bulk',
      handler: 'tag.bulkCreate',
      config: {
        auth: false // or `true` if you want to secure it
      }
    }
  ]
};
