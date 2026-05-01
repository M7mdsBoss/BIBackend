import { defineConfig } from 'prisma/config'
import 'dotenv/config'

const host = process.env.DB_PROD_HOST
const port = process.env.DB_PROD_PORT || '5432'
const name = process.env.DB_PROD_NAME
const user = process.env.DB_PROD_USER
const password = process.env.DB_PROD_PASSWORD

const datasourceUrl = `postgresql://${encodeURIComponent(user ?? '')}:${encodeURIComponent(password ?? '')}@${host}:${port}/${name}`

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: {
        path: 'prisma/migrations',
        seed: 'tsx prisma/seed.ts',
    },
    datasource: {
        url: datasourceUrl,
    },
})
