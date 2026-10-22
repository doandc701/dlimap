export default defineEventHandler((event) => {
  const code = getRouterParam(event, 'code')!.toUpperCase()
  return roomMembers(code)
})
