/**
 * Task catalog v2: seeds `tasks/{taskId}` once the owner approves it.
 *
 * Rules: every task is about the player's own surroundings; no strangers,
 * documents, close-ups of children's faces or risky places; kids tasks are
 * never hard outdoor ones and never leave a child alone; cheap tasks never
 * require buying anything.
 */
export * from './task-catalog.model';
export { catalogData as catalog, retiredCatalogData as retiredCatalog } from './task-catalog.data';
