export default {
  routes: [
    {
      method: 'GET',
      path: '/mcq-sets/slug/:slug',
      handler: 'mcq-set.findBySlug',
      config: {
        auth: false
      }
    }
  ]
};
