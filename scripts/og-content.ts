import { parse, type DefaultTreeAdapterMap } from "parse5";

export function ogContent(source: string, file: string): { headline: string; description: string } {
  const elements: DefaultTreeAdapterMap["element"][] = [];
  function visit(node: DefaultTreeAdapterMap["node"]): void {
    if ("tagName" in node) elements.push(node);
    if ("childNodes" in node) node.childNodes.forEach(visit);
  }
  visit(parse(source));
  const text = (node: DefaultTreeAdapterMap["node"]): string =>
    "value" in node ? node.value : "childNodes" in node ? node.childNodes.map(text).join("") : "";
  const headings = elements.filter((element) => element.tagName === "h1");
  const headline = headings.length === 1 ? text(headings[0]).replace(/\s+/g, " ").trim() : "";
  const description = elements.find((element) =>
    element.tagName === "meta" && element.attrs.some((attr) => attr.name === "name" && attr.value === "description"))
    ?.attrs.find((attr) => attr.name === "content")?.value.trim();
  if (!headline || !description) {
    throw new Error(`OG image requires exactly one nonempty h1 and a meta description: ${file}`);
  }
  return { headline, description };
}
