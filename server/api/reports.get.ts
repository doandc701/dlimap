/** Community-reported cameras / hazards that haven't expired or been voted away. */
export default defineEventHandler(async () => (await loadReports()).map(publicReport))
