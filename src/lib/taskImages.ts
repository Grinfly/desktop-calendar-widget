export const MAX_TASK_IMAGE_BYTES = 5 * 1024 * 1024;

export const taskImageLink = (number: number) => `[图片${number}]`;
const imageLinks = /\[图片([1-9]\d*)\]/g;

export function noteImageNumbers(note: string) {
  return new Set(Array.from(note.matchAll(imageLinks), (match) => Number(match[1])));
}

export function noteWithImageLinks(note: string, imageCount: number): string {
  const linked = noteImageNumbers(note);
  const missing = Array.from({ length: imageCount }, (_, index) => index + 1)
    .filter((number) => !linked.has(number))
    .map(taskImageLink);
  return missing.length ? [note, missing.join(" ")].filter(Boolean).join("\n") : note;
}

export function keepLinkedNoteImages(note: string, images: string[]) {
  const linked = noteImageNumbers(note);
  const numbers = new Map<number, number>();
  const kept = images.filter((_, index) => {
    if (!linked.has(index + 1)) return false;
    numbers.set(index + 1, numbers.size + 1);
    return true;
  });
  return {
    note: note.replace(imageLinks, (token, digits: string) => {
      const number = numbers.get(Number(digits));
      return number === undefined ? token : taskImageLink(number);
    }),
    noteImages: kept.length ? kept : undefined,
  };
}

export function splitNoteImageLinks(note: string, imageCount: number) {
  const parts: (string | number)[] = [];
  let end = 0;
  for (const match of note.matchAll(imageLinks)) {
    const number = Number(match[1]);
    if (number > imageCount) continue;
    parts.push(note.slice(end, match.index), number);
    end = match.index + match[0].length;
  }
  return [...parts, note.slice(end)];
}

export function removeNoteImageLink(note: string, number: number, imageCount: number) {
  return note.replace(imageLinks, (token, digits: string) => {
    const linked = Number(digits);
    if (linked === number) return "";
    return linked > number && linked <= imageCount ? taskImageLink(linked - 1) : token;
  });
}

export function isTaskImage(value: unknown): value is string {
  return typeof value === "string" &&
    /^data:image\/(?:png|jpeg|gif|webp|bmp|avif);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}
