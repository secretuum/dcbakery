// Пустой модуль-заглушка для node:test (см. test-resolver.mjs).
// Next.js подменяет "server-only"/"client-only" своими алиасами при сборке, пакетов в
// node_modules нет — поэтому нативный node:test не может импортировать модуль с
// `import "server-only"`. Резолвер направляет такие импорты сюда.
export {};
