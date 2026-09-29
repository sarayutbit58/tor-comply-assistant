export async function recognizePage(page, imageLoader, recognizer) {
  const image = await imageLoader(page);
  return { page, ...await recognizer(image) };
}
