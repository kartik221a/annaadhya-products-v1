/**
 * CMS → designed-page slot mapping.
 *
 * THE BUG THIS FIXES: built-in designed pages (Our Story /about, Contact)
 * ship a boot-seeded CMS document that mirrors the approved copy section by
 * section. When an admin edits anything and publishes, the WHOLE document was
 * previously dumped into one generic "story band" while the approved design
 * below still rendered its own copy — every section appeared twice and the
 * page collapsed into a plain wall of blocks ("the design becomes very ugly").
 *
 * THE FIX: admin sections flow INTO the approved designs by their stable
 * anchor ids. Each known id maps to one editable slot of the design (hero
 * copy, philosophy paragraphs, principle cards, …); only sections with an
 * unknown/blank id render as an extra story band. A managed slot falls back
 * per-part to the approved copy whenever the admin left that part empty, so a
 * half-edited page can never render hollow, and a design section the admin
 * has not touched keeps the approved look exactly.
 *
 * This module is pure data-shaping (no React, no fetching) so it can be unit-
 * sanity-checked against the shipped boot-seed documents.
 */
import type { CmsDocumentBlock, CmsSection, PublicPageDoc } from "@/lib/types";

/** The editable copy a single design slot consumes. */
export interface SlotCopy {
  eyebrow?: string;
  title?: string;
  paragraphs: string[];
  listItems: { title?: string; text: string }[];
  cards: { title: string; text: string }[];
  image?: { src: string; alt: string; caption?: string };
  ctas: { label: string; href: string; note?: string }[];
  banner?: { title: string; text: string };
}

export interface MappedCmsPage {
  /** The admin's page title (already trimmed). */
  title: string;
  /** The admin's document lede (already trimmed). */
  lede: string;
  /** Managed slots by their stable anchor id (only ids the page declares). */
  byId: Record<string, SlotCopy>;
  /** Sections with an unknown/blank anchor id that carry blocks — these render
   *  as the extra story band inside the design. */
  extras: { section: CmsSection; blocks: CmsDocumentBlock[] }[];
}

function emptySlot(): SlotCopy {
  return { paragraphs: [], listItems: [], cards: [], ctas: [] };
}

function toSlot(section: CmsSection): SlotCopy {
  const slot = emptySlot();
  if (section.eyebrow?.trim()) slot.eyebrow = section.eyebrow.trim();
  if (section.title?.trim()) slot.title = section.title.trim();
  for (const block of section.blocks ?? []) {
    switch (block.type) {
      case "paragraph":
        if (block.text.trim()) slot.paragraphs.push(block.text.trim());
        break;
      case "list":
        if (block.items.length > 0) slot.listItems.push(...block.items);
        break;
      case "cards":
        if (block.items.length > 0) {
          slot.cards.push(...block.items.map((i) => ({ title: i.title, text: i.text })));
        }
        break;
      case "image":
        if (block.src.trim()) {
          slot.image = { src: block.src.trim(), alt: block.alt?.trim() || "", caption: block.caption?.trim() || undefined };
        }
        break;
      case "cta":
        if (block.label.trim() && block.href.trim()) {
          slot.ctas.push({ label: block.label.trim(), href: block.href.trim(), note: block.note?.trim() || undefined });
        }
        break;
      case "banner":
        if (block.title.trim() || block.text.trim()) {
          slot.banner = { title: block.title.trim(), text: block.text.trim() };
        }
        break;
      default:
        break;
    }
  }
  return slot;
}

/**
 * Map an admin-published page into design slots.
 *
 * @param page      the public page doc (or null)
 * @param knownIds  the stable anchor ids the designed page consumes, e.g.
 *                  ["story","philosophy",…] for /about
 */
export function mapCmsPageToSlots(
  page: PublicPageDoc | null,
  knownIds: readonly string[],
): MappedCmsPage | null {
  if (!page?.adminEdited || page.content.kind !== "document") return null;
  const content = page.content;
  const known = new Set(knownIds);
  const byId: Record<string, SlotCopy> = {};
  const extras: MappedCmsPage["extras"] = [];
  for (const section of content.sections) {
    const id = section.id?.trim() ?? "";
    if (id && known.has(id)) {
      byId[id] = toSlot(section);
    } else if ((section.blocks ?? []).length > 0) {
      extras.push({ section, blocks: section.blocks });
    }
  }
  return {
    title: page.title.trim(),
    lede: content.lede?.trim() ?? "",
    byId,
    extras,
  };
}

/** True when the admin actually customized the page title away from the shipped default. */
export function isCustomizedTitle(mapped: MappedCmsPage | null, fallbackTitle: string): string | null {
  const title = mapped?.title ?? "";
  if (!title || title.toLowerCase() === fallbackTitle.trim().toLowerCase()) return null;
  return title;
}
