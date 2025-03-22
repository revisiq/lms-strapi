// path: ./config/database.js

export default ({ env }) => ({
    connection: {
        client: 'postgres',
        connection: {
            connectionString: env('DATABASE_URL'), // Use Railway's PostgreSQL URL
            ssl: env('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false
        },
        pool: {
            min: 2,
            max: 10
        }
    }
});
