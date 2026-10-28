"use client";
/**
 * /pages/[id]/edit — the CMS page editor.
 *
 * Data flow (the API has no GET-one for pages): load GET /admin/content/pages and
 * find by id. Edits live in local state; Save upserts the FULL body via
 * POST /admin/content/pages/:id — saving never publishes (Publish/Unpublish are
 * explicit and go through the same upsert with the new status).
 *
 * Guards mirrored from the server contract:
 *  - built-in slugs/page types are frozen (inputs disabled with an explanation);
 *  - publishing requires at least one content block (client check + the server's
 *    422 message surfaced verbatim in the inline banner);
 *  - maxlengths everywhere are the server's zod limits.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ApiError, apiGet, apiPost, can } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApiQuery, usePageTitle } from "@/lib/hooks";
import { useToast } from "@/lib/toast";
import type { CmsPageContent, CmsSection, FaqEntry, PageDoc, PageStatus } from "@/lib/types";
import { formatINR } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/skeleton";
import { MediaUploader } from "@/components/products/media-uploader";
import { DocumentSectionsEditor, type ShippingFigures } from "@/components/pages/blocks-editor";
import { FaqEntriesEditor } from "@/components/pages/faq-editor";
import { CmsPreview } from "@/components/pages/cms-preview";
import { BLOCK_LIMITS, SLUG_RE, normalizeContent, pageUrlFor } from "@/components/pages/page-shared";
import { IconDoc, IconFaq, IconLock } from "@/components/pages/icons";
import { IconChevronLeft, IconChevronRight } from "@/components/inventory/icons";

interface PublicSettingsShape {
  shipping: {
    mode: "flat_rate" | "free_shipping" | "disabled";
    flatRatePaise: number;
    freeAbovePaise: number | null;
  };
}

function contentHasBlocks(content: CmsPageContent): boolean {
  if (content.kind === "faq") return content.entries.length > 0;
  return content.sections.some((s) => (s.blocks ?? []).length > 0);
}

/** Client-side mirror of the server's pageUpsertSchema — plain checks, honest messages. */
function validatePage(input: {
  title: string;
  slug: string;
  builtIn: boolean;
  status: PageStatus;
  content: CmsPageContent;
}): string[] {
  const errors: string[] = [];
  if (input.title.trim().length < 2) errors.push("Title must be at least 2 characters.");
  if (input.title.trim().length > 160) errors.push("Title must be at most 160 characters.");
  if (!input.builtIn && !SLUG_RE.test(input.slug.trim())) {
    errors.push("Slug must be lowercase letters, numbers and single dashes (e.g. gift-guide-2026).");
  }

  if (input.content.kind === "document") {
    if ((input.content.lede ?? "").length > BLOCK_LIMITS.lede) errors.push("Lede must be at most 600 characters.");
    input.content.sections.forEach((section, si) => {
      const where = `Section ${si + 1}`;
      if (section.id && !SLUG_RE.test(section.id)) {
        errors.push(`${where}: anchor id must be lowercase-with-dashes (or left empty).`);
      }
      if ((section.blocks ?? []).length > 120) errors.push(`${where}: a section can hold at most 120 blocks.`);
      (section.blocks ?? []).forEach((block, bi) => {
        const at = `${where}, block ${bi + 1} (${block.type})`;
        switch (block.type) {
          case "list":
            if (block.items.length === 0) errors.push(`${at}: needs at least one item.`);
            else if (block.items.length > 40) errors.push(`${at}: lists can hold at most 40 items.`);
            break;
          case "cards":
            if (block.items.length === 0) errors.push(`${at}: needs at least one card.`);
            else if (block.items.length > 12) errors.push(`${at}: cards can hold at most 12 items.`);
            break;
          case "steps":
            if (block.items.length === 0) errors.push(`${at}: needs at least one step.`);
            else if (block.items.length > 12) errors.push(`${at}: steps can hold at most 12 items.`);
            break;
          case "table": {
            if (block.head.length === 0 || block.head.every((c) => c === "")) {
              errors.push(`${at}: needs at least one header column.`);
            } else if (block.head.length > 8) {
              errors.push(`${at}: tables can have at most 8 columns.`);
            }
            if (block.rows.length > 60) errors.push(`${at}: tables can have at most 60 rows.`);
            if (block.rows.some((r) => r.length > 8)) errors.push(`${at}: a row can have at most 8 cells.`);
            break;
          }
          case "cta":
            if (!(block.href.startsWith("/") || /^https?:\/\/.+/i.test(block.href))) {
              errors.push(`${at}: destination must be a site path (/…) or an absolute http(s) URL.`);
            }
            break;
          case "image":
            if (!(/^https?:\/\/.+/i.test(block.src) || block.src.startsWith("/"))) {
              errors.push(`${at}: image URL must be absolute (https://…) or a site-rooted path (/…).`);
            }
            break;
          default:
            break;
        }
      });
    });
    if (input.content.sections.length > 30) errors.push("A page can hold at most 30 sections.");
  } else {
    if (input.content.entries.length > 120) errors.push("FAQ pages can hold at most 120 entries.");
    if ((input.content.intro ?? "").length > BLOCK_LIMITS.lede) errors.push("Intro must be at most 600 characters.");
  }

  if (input.status === "published" && !contentHasBlocks(input.content)) {
    errors.push("Publishing requires at least one content block. Save as a draft instead.");
  }
  return errors;
}

export default function PageEditorRoute() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const { principal } = useAuth();
  const toast = useToast();
  const canWrite = can(principal, "content:write");

  /* ---------------------------------- data ---------------------------------- */
  const { data: pages, loading, error, reload } = useApiQuery<PageDoc[]>(() => apiGet<PageDoc[]>("/admin/content/pages"), []);
  const page = useMemo(() => (pages ?? []).find((p) => p.id === id) ?? null, [pages, id]);

  usePageTitle(page ? `Edit — ${page.title}` : "Pages");

  // Live shipping figures for the shippingTiers block + preview (public endpoint).
  const { data: publicSettings } = useApiQuery<PublicSettingsShape | null>(async () => {
    try {
      return await apiGet<PublicSettingsShape>("/settings/public");
    } catch {
      return null; // preview hint only — never blocks editing
    }
  }, []);
  const shipping: ShippingFigures | null = useMemo(() => {
    const s = publicSettings?.shipping;
    if (!s) return null;
    const money = (paise: number) => formatINR(paise).replace(/\.00$/, "");
    return {
      mode: s.mode,
      flatLabel: money(s.flatRatePaise),
      freeAboveLabel: s.freeAbovePaise != null ? `Orders above ${money(s.freeAbovePaise)}` : null,
    };
  }, [publicSettings]);

  /* --------------------------------- state ---------------------------------- */
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<PageStatus>("draft");
  const [content, setContent] = useState<CmsPageContent>({ kind: "document", sections: [{ blocks: [] }] });
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [socialImage, setSocialImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(true);

  // Hydrate the editable state once per page identity (never on background reloads,
  // so a save → reload cycle cannot clobber newer local edits).
  useEffect(() => {
    if (!page || page.id === hydratedId) return;
    setTitle(page.title);
    setSlug(page.slug);
    setStatus(page.status);
    setContent(normalizeContent(page));
    setSeoTitle(page.seo?.title ?? "");
    setSeoDescription(page.seo?.description ?? "");
    setSocialImage(page.seo?.socialImage ?? "");
    setHydratedId(page.id);
    setValidationErrors(null);
    setSaveError(null);
  }, [page, hydratedId]);

  function applyDoc(doc: PageDoc) {
    setTitle(doc.title);
    setSlug(doc.slug);
    setStatus(doc.status);
    setContent(normalizeContent(doc));
    setSeoTitle(doc.seo?.title ?? "");
    setSeoDescription(doc.seo?.description ?? "");
    setSocialImage(doc.seo?.socialImage ?? "");
    setHydratedId(doc.id);
  }

  const builtIn = page?.builtIn ?? false;
  const pageType = page?.pageType ?? "document";
  const liveUrl = page ? pageUrlFor({ slug: slug.trim() || page.slug, builtIn }) : "";

  async function save(nextStatus?: PageStatus) {
    if (!page) return;
    const statusToUse = nextStatus ?? status;
    const errors = validatePage({ title, slug, builtIn, status: statusToUse, content });
    if (errors.length > 0) {
      setValidationErrors(errors);
      setSaveError(null);
      return;
    }
    setValidationErrors(null);
    setSaveError(null);
    setSaving(true);
    try {
      const seoEmpty = !seoTitle.trim() && !seoDescription.trim() && !socialImage.trim();
      const doc = await apiPost<PageDoc>(`/admin/content/pages/${page.id}`, {
        slug: slug.trim(),
        title: title.trim(),
        pageType,
        status: statusToUse,
        content,
        ...(seoEmpty ? {} : { seo: { ...(seoTitle.trim() ? { title: seoTitle.trim() } : {}), ...(seoDescription.trim() ? { description: seoDescription.trim() } : {}), ...(socialImage.trim() ? { socialImage: socialImage.trim() } : {}) } }),
      });
      applyDoc(doc);
      toast.success(
        nextStatus === "published" ? "Page published" : nextStatus === "draft" ? "Page unpublished" : "Page saved",
        `“${doc.title}” · ${pageUrlFor(doc)}`,
      );
      reload();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Unexpected error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------ content setters ----------------------------- */
  function setDocument(patch: { lede?: string; sections?: CmsSection[] }) {
    setContent((c) => (c.kind === "document" ? { ...c, ...patch } : c));
  }
  function setFaq(patch: { intro?: string; entries?: FaqEntry[] }) {
    setContent((c) => (c.kind === "faq" ? { ...c, ...patch } : c));
  }

  /* ---------------------------------- views ---------------------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message} status={error.status} onRetry={reload} />;
  }

  if (!page) {
    return (
      <ErrorState
        message={`No page exists with id “${id}”. It may have been deleted — go back to the Pages console.`}
        status={404}
      />
    );
  }

  if (!canWrite) {
    return <ErrorState message="You don't have permission to edit pages (content:write is required)." status={403} />;
  }

  return (
    <div>
      {/* ------------------------------ sticky save bar ------------------------------ */}
      <div className="sticky top-20 z-20 mb-6 rounded-xl border border-outline-variant/40 bg-surface-container-lowest/95 px-4 py-3 shadow-[0_2px_12px_rgba(39,24,16,0.10)] backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/pages"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-container-low px-2.5 text-xs font-semibold text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container hover:text-primary"
            >
              <IconChevronLeft className="h-4 w-4" />
              Pages
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-primary">
                {pageType === "faq" ? <IconFaq className="h-4.5 w-4.5" /> : <IconDoc className="h-4.5 w-4.5" />}
              </span>
              <div className="min-w-0">
                <p className="max-w-[18rem] truncate font-display text-base font-semibold text-primary" title={title || page.title}>
                  {title || page.title}
                </p>
                <p className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
                  <StatusBadge status={status} />
                  {builtIn ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-on-tertiary-fixed">
                      Built-in
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary-container px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-on-secondary-container">
                      Custom
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPreviewOpen((v) => !v)}>
              {previewOpen ? "Hide preview" : "Show preview"}
            </Button>
            {status === "published" ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface shadow-sm transition-colors hover:bg-surface-container"
              >
                View on storefront ↗
              </a>
            ) : null}
            {status === "published" ? (
              <Button variant="outline" size="sm" loading={saving} onClick={() => void save("draft")}>
                Unpublish
              </Button>
            ) : (
              <Button variant="secondary" size="sm" loading={saving} onClick={() => void save("published")}>
                Publish
              </Button>
            )}
            <Button size="sm" loading={saving} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* --------------------------------- banners --------------------------------- */}
      {validationErrors && validationErrors.length > 0 ? (
        <div role="alert" className="mb-4 rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm text-on-error-container">
          <p className="font-semibold">The page can&apos;t be saved yet:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {saveError ? (
        <div role="alert" className="mb-4 rounded-xl border border-error/30 bg-error-container px-4 py-3 text-sm font-medium text-on-error-container">
          {saveError}
        </div>
      ) : null}
      {/* Our Story is a bespoke designed page: the boot-seeded CMS mirror must not
          hijack it silently — tell the admin exactly when an edit takes over. */}
      {builtIn && page?.slug === "our-story" && !page.adminEdited ? (
        <div className="mb-4 rounded-xl border border-tertiary/30 bg-tertiary-fixed/40 px-4 py-3 text-sm text-on-tertiary-fixed-variant">
          <p className="font-semibold">Our Story shows the approved brand design on the storefront.</p>
          <p className="mt-0.5 text-[13px]">
            The live /about page keeps that designed layout until you publish custom content here —
            publishing swaps it for this editor&apos;s document layout. Restore the shipped default any
            time from the Pages list.
          </p>
        </div>
      ) : null}

      {/* ------------------------------ editor + preview ----------------------------- */}
      <div className={previewOpen ? "grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" : ""}>
        <div className="min-w-0 space-y-5">
          {/* Basics */}
          <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-[0_1px_8px_rgba(39,24,16,0.05)] sm:p-5">
            <h2 className="label-eyebrow mb-3 text-secondary">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required hint="2–160 characters — the heading on the storefront.">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} disabled={saving} />
              </Field>
              <Field
                label="Slug"
                required
                hint={
                  builtIn
                    ? "Built-in slugs are frozen — the live URL (/about, /faq, /policies/…) depends on them."
                    : `Live URL: /p/${slug.trim() || "…"}`
                }
              >
                <div className="relative">
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    maxLength={96}
                    disabled={saving || builtIn}
                    className={`font-mono ${builtIn ? "pr-9" : ""}`}
                  />
                  {builtIn ? (
                    <IconLock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
                  ) : null}
                </div>
              </Field>
              <Field label="Page type" hint="Fixed after creation — documents and FAQs render differently.">
                <div className="flex h-11 items-center">
                  <span className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2 text-[13px] font-semibold text-on-surface">
                    {pageType === "faq" ? <IconFaq className="h-4 w-4 text-primary" /> : <IconDoc className="h-4 w-4 text-primary" />}
                    {pageType === "faq" ? "FAQ" : "Document"}
                  </span>
                </div>
              </Field>
              <Field label="Status" hint="Saving never publishes — use Publish for that.">
                <Select
                  value={status}
                  disabled={saving}
                  onChange={(e) => setStatus(e.target.value as PageStatus)}
                >
                  <option value="draft">Draft — hidden from the storefront</option>
                  <option value="published">Published — live</option>
                  <option value="archived">Archived — retired, URL gone</option>
                </Select>
              </Field>
            </div>
            {builtIn ? (
              <p className="mt-3 rounded-lg bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                This is a built-in page: the slug and page type can&apos;t change (its storefront URL is frozen), it can&apos;t be
                deleted, and you can restore the shipped default content from the Pages list.
              </p>
            ) : null}
          </section>

          {/* SEO */}
          <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-[0_1px_8px_rgba(39,24,16,0.05)] sm:p-5">
            <h2 className="label-eyebrow mb-3 text-secondary">SEO &amp; sharing</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="SEO title (optional)" hint="Search-engine title; falls back to the page title.">
                <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} maxLength={BLOCK_LIMITS.seoTitle} disabled={saving} />
              </Field>
              <Field label="Social image (optional)" hint="Absolute https://… URL — used for link previews.">
                <div className="flex items-center gap-2">
                  {socialImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- absolute CMS asset URLs, mirrors the storefront
                    <img src={socialImage} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-outline-variant/40 object-cover" />
                  ) : null}
                  <Input
                    value={socialImage}
                    onChange={(e) => setSocialImage(e.target.value)}
                    maxLength={600}
                    disabled={saving}
                    className="font-mono text-xs"
                    placeholder="https://res.cloudinary.com/…"
                  />
                  <MediaUploader onUploaded={(media) => setSocialImage(media.url)} disabled={saving}>
                    Upload
                  </MediaUploader>
                </div>
              </Field>
              <Field
                label="SEO description (optional)"
                hint="Shown under the title in search results and link previews (max 300)."
                className="sm:col-span-2"
              >
                <Textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  maxLength={BLOCK_LIMITS.seoDescription}
                  rows={2}
                  disabled={saving}
                />
              </Field>
            </div>
          </section>

          {/* Content */}
          <section className="rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-[0_1px_8px_rgba(39,24,16,0.05)] sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="label-eyebrow text-secondary">Content</h2>
              <span className="text-[11px] text-outline">
                Inline markup: <span className="font-mono">**bold**</span> · <span className="font-mono">*italic*</span> ·{" "}
                <span className="font-mono">[label](/href)</span>
              </span>
            </div>

            {content.kind === "document" ? (
              <div className="space-y-5">
                <Field
                  label="Lede (optional)"
                  hint={`Short standfirst under the page title (max ${BLOCK_LIMITS.lede}).`}
                >
                  <Textarea
                    value={content.lede ?? ""}
                    onChange={(e) => setDocument({ lede: e.target.value })}
                    maxLength={BLOCK_LIMITS.lede}
                    rows={2}
                    disabled={saving}
                  />
                </Field>
                <div>
                  <p className="mb-2 text-xs font-semibold text-on-surface-variant">
                    Sections — policy-style pages use several; each becomes a TOC anchor group.
                  </p>
                  <DocumentSectionsEditor
                    sections={content.sections}
                    onChange={(sections) => setDocument({ sections })}
                    disabled={saving}
                    shipping={shipping}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <Field label="Intro (optional)" hint={`A short paragraph above the questions (max ${BLOCK_LIMITS.lede}).`}>
                  <Textarea
                    value={content.intro ?? ""}
                    onChange={(e) => setFaq({ intro: e.target.value })}
                    maxLength={BLOCK_LIMITS.lede}
                    rows={2}
                    disabled={saving}
                  />
                </Field>
                <div>
                  <p className="mb-2 text-xs font-semibold text-on-surface-variant">
                    Questions — grouped by category on the storefront FAQ explorer.
                  </p>
                  <FaqEntriesEditor
                    entries={content.kind === "faq" ? content.entries : []}
                    onChange={(entries) => setFaq({ entries })}
                    disabled={saving}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {previewOpen ? (
          <aside className="xl:sticky xl:top-36">
            <CmsPreview title={title} pageType={pageType} status={status} content={content} shipping={shipping} />
          </aside>
        ) : null}
      </div>

      <p className="mt-6 flex items-center justify-center gap-1 text-[11px] text-outline sm:justify-end">
        <IconChevronRight className="h-3 w-3" />
        Draft saves never touch the live page — publishing is a separate, explicit step
      </p>
    </div>
  );
}
