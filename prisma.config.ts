import { defineConfig } from '@prisma/config'

export default defineConfig({
    schema: './prisma/schema.prisma',
    // você pode adicionar outras configs aqui se precisar:
    // output: './node_modules/.prisma/client',
})
