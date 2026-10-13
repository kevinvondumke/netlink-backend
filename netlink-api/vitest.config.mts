import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        fileParallelism: false,
        include: ['tests/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    },
});
