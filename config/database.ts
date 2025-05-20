// ./config/database.js
import path from 'path';

export default ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  const connections = {
    sqlite: {
      client: 'sqlite',
      connection: {
        filename: path.join(__dirname, '..', '..', env('DATABASE_FILENAME', '.tmp/data.db'))
      },
      useNullAsDefault: true
    },
    postgres: {
      client: 'postgres',
      connection: {
        connectionString: env('DATABASE_URL'),
        ssl: env.bool('DATABASE_SSL', false) ? { rejectUnauthorized: false } : false
      },
      pool: {
        min: env.int('DATABASE_POOL_MIN', 2),
        max: env.int('DATABASE_POOL_MAX', 10)
      }
    }
  };

  return { connection: connections[client] };
};
