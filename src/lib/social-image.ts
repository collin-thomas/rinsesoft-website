export function socialImagePath(pagePath: string): string {
  const route = pagePath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `/img/og/${route || "index"}.png`;
}
