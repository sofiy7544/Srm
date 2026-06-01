/**
 * /qualify — экран квалификации unclaimed-контактов.
 *
 * Согласно принятым решениям квалификация (Contact/Client → QualifyDialog →
 * создание Lead) живёт отдельно от /pool. Переиспользует проверенный экран
 * квалификации без дублирования Lead-логики: unclaimed contact → QualifyDialog
 * → creates lead → lead появляется в /pool → admin claim/assign → realtor works.
 */
export { default } from '../inbox/page';
