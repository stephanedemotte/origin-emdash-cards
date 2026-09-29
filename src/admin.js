/**
 * THE CARDS WIDGET — `origin-emdash-cards:cards`, for repeater fields.
 *
 * The admin passes a field widget the repeater's value (an array of plain
 * objects), `onChange`, its `validation` (with `subFields`, `minItems`,
 * `maxItems`) and the widget `options`. This widget renders:
 *
 * - a GRID OF CARDS, one per item: thumbnail (first image sub-field), title
 *   (first text sub-field), summary (the next one); drag a card to reorder;
 * - a SLIDE-OUT PANEL on the right that edits ONE item's sub-fields. Edits
 *   apply as you type, exactly like the built-in repeater, so autosave and the
 *   draft preview see them; "Done" or Escape closes the panel.
 *
 * Repeater sub-fields are limited to string, text, url, number, integer,
 * boolean, datetime, select and image. Each is rendered with the same Kumo
 * component the admin uses; images go through the admin's own media picker
 * (`MediaPickerModal`) and are stored in the admin's own value shape
 * (`mediaItemToImageFieldValue`, restated below), so nothing downstream can
 * tell this widget from the built-in one.
 *
 * Plain `createElement`, no JSX: the file is used as shipped. Layout with
 * inline styles on the admin's theme variables (`--color-kumo-*`): the admin's
 * Tailwind is precompiled, so a class it doesn't use itself would not exist.
 */
import { createElement as h, Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Button, Combobox, Input, InputArea, Switch } from "@cloudflare/kumo";
import { Dialog } from "@cloudflare/kumo/primitives/dialog";
import { MediaPickerModal } from "@emdash-cms/admin";

// ——— Words ———

const FR = typeof document !== "undefined" && /^fr/i.test(document.documentElement.lang || navigator.language || "");
const T = FR
  ? { add: "Ajouter", done: "Terminé", remove: "Supprimer", confirmRemove: "Supprimer cet élément ?", choose: "Choisir une image", replace: "Remplacer", clear: "Retirer", untitled: "Sans titre", item: "Élément", empty: "Aucun élément pour l'instant.", drag: "glisser pour réordonner (ou Alt + flèches)", select: "Choisir…", noResults: "Aucun résultat", edit: "Modifier" }
  : { add: "Add", done: "Done", remove: "Remove", confirmRemove: "Remove this item?", choose: "Choose an image", replace: "Replace", clear: "Clear", untitled: "Untitled", item: "Item", empty: "No items yet.", drag: "drag to reorder (or Alt + arrows)", select: "Select…", noResults: "No results", edit: "Edit" };

// ——— Media, in the admin's own shapes ———

const MEDIA_PREFIX = "/_emdash/api/media/file/";
const providerId = (p) => (!p ? "local" : p === "external-url" ? "external" : p);
const metaString = (meta, key) => (meta && typeof meta[key] === "string" ? meta[key] : undefined);

/** `@emdash-cms/admin`'s `mediaItemToImageFieldValue`, restated: the value an image sub-field stores. */
const toImageValue = (item) => {
  const provider = providerId(item.provider);
  const local = provider === "local";
  const direct = provider === "external";
  return {
    id: item.id,
    provider,
    src: direct ? item.url : undefined,
    previewUrl: !local && !direct ? item.url : undefined,
    alt: item.alt || "",
    width: item.width,
    height: item.height,
    focalX: item.focalX ?? undefined,
    focalY: item.focalY ?? undefined,
    filename: item.filename,
    mimeType: item.mimeType,
    blurhash: item.blurhash ?? metaString(item.meta, "blurhash"),
    dominantColor: item.dominantColor ?? metaString(item.meta, "dominantColor"),
    meta: local ? { ...item.meta, storageKey: item.storageKey } : item.meta,
  };
};

/** `@emdash-cms/admin`'s `mediaDisplayUrl`, restated: where to show an image value from. */
const imageUrl = (v) => {
  if (typeof v === "string") return v || undefined;
  if (!v) return undefined;
  if (v.previewUrl || v.src) return v.previewUrl || v.src;
  const key = typeof v.meta?.storageKey === "string" ? v.meta.storageKey : v.id;
  if (!key) return undefined;
  return `${MEDIA_PREFIX}${String(key).split("/").map(encodeURIComponent).join("/")}`;
};

/** The drag handle: six dots, drawn, so it sits the same in every font. */
const GRIP = h(
  "svg",
  { width: 10, height: 14, viewBox: "0 0 10 14", fill: "currentColor", style: { display: "block" } },
  ...[2, 7, 12].flatMap((y) => [h("circle", { key: `a${y}`, cx: 2.5, cy: y, r: 1.4 }), h("circle", { key: `b${y}`, cx: 7.5, cy: y, r: 1.4 })]),
);

// ——— Items ———

let seq = 0;
const newKey = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;
const withKeys = (value, previous = []) =>
  (Array.isArray(value) ? value : []).map((item, i) => ({ key: previous[i]?.key ?? newKey(), data: item && typeof item === "object" ? item : {} }));
const emptyItem = (subFields) =>
  Object.fromEntries(subFields.map((sf) => [sf.slug, sf.type === "boolean" ? false : ["number", "integer", "image"].includes(sf.type) ? null : ""]));

const TEXTUAL = ["string", "text", "url", "select"];
const plain = (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").trim();

/** Which sub-fields a card shows, from the widget options or the sub-field order. */
const cardLayout = (subFields, options = {}) => {
  const texts = subFields.filter((sf) => TEXTUAL.includes(sf.type)).map((sf) => sf.slug);
  const title = options.title ?? texts[0];
  return {
    title,
    subtitle: options.subtitle ?? texts.find((s) => s !== title),
    image: options.image ?? subFields.find((sf) => sf.type === "image")?.slug,
  };
};

// ——— Styles (inline, on the admin's theme variables) ———

const line = "1px solid var(--color-kumo-line)";
const S = {
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 },
  card: (dragging, over) => ({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    border: over ? "1px solid var(--color-kumo-brand)" : line,
    outline: over ? "2px solid var(--color-kumo-brand)" : "none",
    outlineOffset: 2,
    borderRadius: 10,
    overflow: "hidden",
    background: "var(--color-kumo-base)",
    cursor: dragging ? "grabbing" : "pointer",
    userSelect: "none",
    opacity: 1,
    transition: "border-color .15s, box-shadow .15s",
    textAlign: "left",
    padding: 0,
    font: "inherit",
    color: "inherit",
  }),
  thumb: { aspectRatio: "4 / 3", background: "var(--color-kumo-recessed, var(--color-kumo-tint))", display: "grid", placeItems: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  thumbNone: { fontSize: 28, opacity: 0.35 },
  body: { padding: "10px 12px 12px", display: "grid", gap: 2, minWidth: 0 },
  // Without a thumbnail, the index and handle badges (8 + 22 px) sit above the title: clear them.
  bodyNoThumb: { padding: "40px 12px 12px", display: "grid", gap: 2, minWidth: 0 },
  title: { fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  subtitle: { fontSize: 12, opacity: 0.65, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" },
  // Same box as the index badge on the left: 22 px, content centred.
  handle: { position: "absolute", top: 8, right: 8, width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 99, cursor: "grab", color: "inherit", opacity: 0.7, background: "color-mix(in srgb, var(--color-kumo-base) 85%, transparent)", border: line, boxSizing: "border-box" },
  index: { position: "absolute", top: 8, left: 8, minWidth: 22, height: 22, boxSizing: "border-box", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 600, lineHeight: 1, padding: "0 7px", borderRadius: 99, background: "color-mix(in srgb, var(--color-kumo-base) 85%, transparent)", border: line },
  add: { border: "1px dashed var(--color-kumo-line)", borderRadius: 10, minHeight: 72, display: "grid", placeItems: "center", cursor: "pointer", background: "transparent", color: "inherit", font: "inherit", fontSize: 14, fontWeight: 500, opacity: 0.8 },
  header: { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 },
  label: { fontSize: 14, fontWeight: 500 },
  count: { fontSize: 12, opacity: 0.6 },
  help: { fontSize: 12, opacity: 0.65, margin: "-4px 0 10px" },
  panel: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    width: "min(560px, 100vw)",
    zIndex: 61,
    display: "flex",
    flexDirection: "column",
    background: "var(--color-kumo-canvas, var(--color-kumo-base))",
    borderLeft: line,
    boxShadow: "-24px 0 48px -24px rgb(0 0 0 / .35)",
    outline: "none",
  },
  panelHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: line },
  panelTitle: { fontSize: 16, fontWeight: 600, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  panelBody: { flex: 1, overflowY: "auto", padding: 20, display: "grid", gap: 18, alignContent: "start" },
  panelFoot: { display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 20px", borderTop: line },
  imageBox: { display: "grid", gap: 8 },
  imagePreview: { width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 8, border: line, background: "var(--color-kumo-recessed, var(--color-kumo-tint))" },
  row: { display: "flex", gap: 8, flexWrap: "wrap" },
};

// ——— Sub-field inputs (the admin's own components, as its repeater uses them) ———

function ImageInput({ id, label, value, onChange }) {
  const [open, setOpen] = useState(false);
  const url = imageUrl(value);
  return h(
    "div",
    { style: S.imageBox },
    h("span", { style: S.label }, label),
    url ? h("img", { src: url, alt: (typeof value === "object" && value?.alt) || "", style: S.imagePreview }) : null,
    h(
      "div",
      { style: S.row },
      h(Button, { type: "button", variant: "secondary", size: "sm", onClick: () => setOpen(true) }, url ? T.replace : T.choose),
      url ? h(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => onChange(null) }, T.clear) : null,
    ),
    h(MediaPickerModal, { open, onOpenChange: setOpen, onSelect: (item) => (onChange(toImageValue(item)), setOpen(false)), mediaKind: "image", fieldId: id }),
  );
}

const toLocalInput = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

function SubField({ id, sf, value, onChange }) {
  switch (sf.type) {
    case "string":
    case "url":
      return h(Input, { id, label: sf.label, type: sf.type === "url" ? "url" : "text", value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value), required: sf.required, dir: "auto" });
    case "text":
      return h(InputArea, { id, label: sf.label, value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value), required: sf.required, rows: 4, dir: "auto" });
    case "number":
    case "integer":
      return h(Input, {
        id,
        label: sf.label,
        type: "number",
        step: sf.type === "integer" ? "1" : "any",
        value: typeof value === "number" ? String(value) : "",
        onChange: (e) => onChange(e.target.value === "" ? null : Number(e.target.value)),
        required: sf.required,
      });
    case "boolean":
      return h(Switch, { id, checked: Boolean(value), onCheckedChange: (c) => onChange(c), label: h("span", null, sf.label) });
    case "datetime":
      return h(Input, {
        id,
        label: sf.label,
        type: "datetime-local",
        value: toLocalInput(value),
        onChange: (e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : ""),
        required: sf.required,
      });
    case "select": {
      const items = Array.isArray(sf.options) ? sf.options : [];
      return h(
        Combobox,
        { id, label: sf.label, value: typeof value === "string" && value ? value : null, onValueChange: (v) => onChange(typeof v === "string" ? v : ""), items, required: sf.required },
        h(Combobox.TriggerInput, { placeholder: T.select }),
        h(Combobox.Content, null, h(Combobox.Empty, null, T.noResults), h(Combobox.List, null, (opt) => h(Combobox.Item, { key: opt, value: opt }, opt))),
      );
    }
    case "image":
      return h(ImageInput, { id, label: sf.label, value, onChange });
    default:
      return h(Input, { id, label: sf.label, value: typeof value === "string" ? value : "", onChange: (e) => onChange(e.target.value) });
  }
}

// ——— The widget ———

function Cards({ value, onChange, label, id, validation, options }) {
  const subFields = useMemo(() => (Array.isArray(validation?.subFields) ? validation.subFields : []), [validation]);
  const minItems = typeof validation?.minItems === "number" ? validation.minItems : 0;
  const maxItems = typeof validation?.maxItems === "number" ? validation.maxItems : Infinity;
  const layout = useMemo(() => cardLayout(subFields, options ?? {}), [subFields, options]);

  // Stable keys for React and for the open panel, kept beside the value (the
  // stored items carry none, like the built-in repeater's stripped `_key`).
  const [items, setItems] = useState(() => withKeys(value));
  const last = useRef(value);
  useEffect(() => {
    if (value === last.current) return;
    last.current = value;
    setItems((prev) => withKeys(value, prev));
  }, [value]);

  const emit = (next) => {
    setItems(next);
    const out = next.map((i) => i.data);
    last.current = out;
    onChange(out);
  };

  const [openKey, setOpenKey] = useState(null);
  // REORDERING, with pointer events — not the browser's HTML5 drag and drop,
  // whose drag session can get stuck (the card fades, nothing moves and the
  // whole page stops taking clicks until the session ends). Here: press a
  // card, move past a small threshold and it follows the pointer; the card
  // under the pointer is the target; release drops, Escape cancels. A press
  // that never passes the threshold is a click and opens the panel.
  const [drag, setDragState] = useState(null); // { from, over, dx, dy }
  const dragRef = useRef(null);
  const suppressClick = useRef(false);
  const setDrag = (d) => {
    dragRef.current = d;
    setDragState(d);
  };
  const startPointer = (e, i) => {
    if (e.button !== 0 || e.pointerType === "touch") return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let moving = false;
    const card = e.currentTarget;
    const grid = card.parentElement;
    const onMove = (ev) => {
      const dx = ev.clientX - x0;
      const dy = ev.clientY - y0;
      if (!moving && Math.hypot(dx, dy) < 6) return;
      if (!moving) {
        moving = true;
        document.body.style.userSelect = "none";
      }
      ev.preventDefault();
      // The card under the pointer (the dragged one ignores the pointer).
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.("[data-card]");
      const over = under && grid.contains(under) ? Number(under.dataset.card) : dragRef.current?.over ?? i;
      setDrag({ from: i, over, dx, dy });
    };
    const end = (drop) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      document.body.style.userSelect = "";
      const d = dragRef.current;
      setDrag(null);
      if (moving) {
        suppressClick.current = true; // the click that follows a drag is not a click
        setTimeout(() => (suppressClick.current = false), 0);
        if (drop && d) move(d.from, d.over);
      }
    };
    const onUp = () => end(true);
    const onCancel = () => end(false);
    const onKey = (ev) => {
      if (ev.key === "Escape" && moving) {
        ev.stopPropagation();
        end(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
  };

  // The item the panel SHOWS outlives `openKey`: on close, Base UI plays the
  // exit transition and only then unmounts the popup, drops the backdrop and
  // lifts `inert` from the page. Unmounting the popup ourselves at close left
  // the backdrop up and the whole admin unclickable.
  const [shownKey, setShownKey] = useState(null);
  useEffect(() => {
    if (openKey) setShownKey(openKey);
  }, [openKey]);
  const isOpen = Boolean(openKey && items.some((i) => i.key === openKey));
  const open = items.find((i) => i.key === (openKey ?? shownKey)) ?? null;
  const openIndex = open ? items.indexOf(open) : -1;

  const add = () => {
    if (items.length >= maxItems) return;
    const item = { key: newKey(), data: emptyItem(subFields) };
    emit([...items, item]);
    setOpenKey(item.key);
  };
  const remove = (key) => {
    if (items.length <= minItems) return;
    if (typeof window !== "undefined" && !window.confirm(T.confirmRemove)) return;
    emit(items.filter((i) => i.key !== key));
    if (openKey === key) setOpenKey(null);
  };
  const setField = (key, slug, v) => emit(items.map((i) => (i.key === key ? { ...i, data: { ...i.data, [slug]: v } } : i)));
  const move = (from, to) => {
    if (from === to || from < 0 || to < 0) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    emit(next);
  };

  // The title sub-field, else an image's alt text or file name, else "Item n".
  const titleOf = (item, i) => {
    const img = layout.image ? item.data[layout.image] : null;
    return plain(item.data[layout.title]) || plain(img?.alt) || plain(img?.filename) || `${T.item} ${i + 1}`;
  };

  // A thumbnail row only when at least one item has an image: a grid of empty
  // placeholders (a list of options, say) is noise.
  const thumbs = Boolean(layout.image) && items.some((it) => imageUrl(it.data[layout.image]));

  return h(
    "div",
    { id, "data-origin-cards": "" },
    h("div", { style: S.header }, h("span", { style: S.label }, label), h("span", { style: S.count }, String(items.length))),
    options?.help ? h("p", { style: S.help }, options.help) : null,
    h(
      "div",
      { style: S.grid },
      items.map((item, i) => {
        const url = layout.image ? imageUrl(item.data[layout.image]) : undefined;
        const sub = layout.subtitle ? plain(item.data[layout.subtitle]) : "";
        return h(
          "div",
          {
            key: item.key,
            role: "button",
            tabIndex: 0,
            title: `${T.edit} — ${T.drag}`,
            "data-card": String(i),
            onClick: () => {
              if (!suppressClick.current) setOpenKey(item.key);
            },
            onPointerDown: (e) => startPointer(e, i),
            onDragStart: (e) => e.preventDefault(), // no native drag, ever
            onKeyDown: (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpenKey(item.key);
              }
              // Alt + arrows move the card: reordering without a mouse.
              if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowUp")) (e.preventDefault(), move(i, i - 1));
              if (e.altKey && (e.key === "ArrowRight" || e.key === "ArrowDown")) (e.preventDefault(), move(i, i + 1));
            },
            style: {
              ...S.card(drag?.from === i, drag && drag.over === i && drag.from !== i),
              // The dragged card follows the pointer, above the others.
              ...(drag?.from === i ? { transform: `translate(${drag.dx}px, ${drag.dy}px)`, zIndex: 5, opacity: 0.85, pointerEvents: "none", boxShadow: "0 12px 32px -8px rgb(0 0 0 / .45)", transition: "none" } : {}),
            },
          },
          h("span", { style: S.index }, String(i + 1)),
          h("span", { style: S.handle, "aria-hidden": "true" }, GRIP),
          thumbs ? h("span", { style: S.thumb }, url ? h("img", { src: url, alt: "", style: S.thumbImg, loading: "lazy", draggable: false }) : h("span", { style: S.thumbNone }, "◻")) : null,
          h("span", { style: thumbs ? S.body : S.bodyNoThumb }, h("span", { style: S.title }, titleOf(item, i)), sub ? h("span", { style: S.subtitle }, sub) : null),
        );
      }),
      items.length < maxItems ? h("button", { type: "button", onClick: add, style: S.add }, `+ ${T.add}`) : null,
    ),
    h(
      Dialog.Root,
      { open: isOpen, onOpenChange: (o) => !o && setOpenKey(null), onOpenChangeComplete: (o) => !o && setShownKey(null) },
      h(
        Dialog.Portal,
        null,
        // The admin's own backdrop classes (they exist in its stylesheet).
        h(Dialog.Backdrop, { className: "fixed inset-0 bg-black/50 transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0", style: { zIndex: 60 } }),
        open
          ? h(
              Dialog.Popup,
              { style: S.panel },
              h(
                "div",
                { style: S.panelHead },
                h(Dialog.Title, { style: S.panelTitle }, `${label} · ${openIndex + 1}/${items.length} — ${titleOf(open, openIndex)}`),
                h(Dialog.Close, { render: h(Button, { type: "button", variant: "ghost", size: "sm" }) }, "✕"),
              ),
              h(
                "div",
                { style: S.panelBody },
                subFields.map((sf) =>
                  h(SubField, { key: sf.slug, id: `${id}.${openIndex}.${sf.slug}`, sf, value: open.data[sf.slug], onChange: (v) => setField(open.key, sf.slug, v) }),
                ),
              ),
              h(
                "div",
                { style: S.panelFoot },
                h(Button, { type: "button", variant: "secondary-destructive", size: "sm", disabled: items.length <= minItems, onClick: () => remove(open.key) }, T.remove),
                h(
                  Fragment,
                  null,
                  h(
                    "div",
                    { style: S.row },
                    h(Button, { type: "button", variant: "secondary", size: "sm", disabled: openIndex <= 0, onClick: () => setOpenKey(items[openIndex - 1].key) }, "←"),
                    h(Button, { type: "button", variant: "secondary", size: "sm", disabled: openIndex >= items.length - 1, onClick: () => setOpenKey(items[openIndex + 1].key) }, "→"),
                    h(Dialog.Close, { render: h(Button, { type: "button", variant: "primary", size: "sm" }) }, T.done),
                  ),
                ),
              ),
            )
          : null,
      ),
    ),
  );
}

// ——— The settings page: a switch per repeater ———

const WIDGET = "origin-emdash-cards:cards";
const P = FR
  ? { title: "Cartes", intro: "Affiche une liste (repeater) en cartes, chaque élément modifié dans un panneau latéral. Un interrupteur par liste ; l'effet est immédiat dans l'éditeur.", none: "Aucune liste (repeater) dans les collections.", loading: "Chargement…", error: "Échec de l'enregistrement :", sub: (n) => `${n} sous-champ${n > 1 ? "s" : ""}`, other: (w) => `utilise déjà le widget « ${w} »` }
  : { title: "Cards", intro: "Shows a repeater as cards, each item edited in a slide-out panel. One switch per repeater; the editor picks it up right away.", none: "No repeater fields in any collection.", loading: "Loading…", error: "Could not save:", sub: (n) => `${n} sub-field${n > 1 ? "s" : ""}`, other: (w) => `already uses the "${w}" widget` };

const api = async (method, path, body) => {
  const r = await fetch(`/_emdash/api/${path}`, {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json", "X-EmDash-Request": "1", ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || d?.success === false) throw new Error(d?.error?.message ?? `${r.status}`);
  return d?.data ?? d;
};

function Settings() {
  const [groups, setGroups] = useState(null); // [{ slug, label, fields: [{ slug, label, widget, subFields }] }]
  const [busy, setBusy] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const { items } = await api("GET", "schema/collections");
      const out = [];
      for (const c of items ?? []) {
        const { item } = await api("GET", `schema/collections/${encodeURIComponent(c.slug)}?includeFields=true`);
        const reps = (item.fields ?? []).filter((f) => f.type === "repeater");
        if (reps.length) out.push({ slug: c.slug, label: c.label, fields: reps.map((f) => ({ slug: f.slug, label: f.label, widget: f.widget ?? "", subFields: f.validation?.subFields?.length ?? 0 })) });
      }
      if (live) setGroups(out);
    })().catch((e) => live && (setError(`${P.error} ${e.message}`), setGroups([])));
    return () => (live = false);
  }, []);

  const toggle = async (c, f, on) => {
    const key = `${c}/${f.slug}`;
    setBusy((b) => ({ ...b, [key]: true }));
    setError("");
    try {
      // "" clears the widget: the admin falls back to its own repeater.
      await api("PUT", `schema/collections/${encodeURIComponent(c)}/fields/${encodeURIComponent(f.slug)}`, { widget: on ? WIDGET : "" });
      setGroups((gs) => gs.map((g) => (g.slug !== c ? g : { ...g, fields: g.fields.map((x) => (x.slug === f.slug ? { ...x, widget: on ? WIDGET : "" } : x)) })));
    } catch (e) {
      setError(`${P.error} ${e.message}`);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  };

  return h(
    "div",
    { style: { maxWidth: 760, display: "grid", gap: 20 } },
    h("div", null, h("h1", { style: { fontSize: 22, fontWeight: 600, margin: 0 } }, P.title), h("p", { style: { marginTop: 6, opacity: 0.7, fontSize: 14 } }, P.intro)),
    error ? h("p", { role: "alert", style: { color: "var(--text-color-kumo-danger, #d33)", fontSize: 14, margin: 0 } }, error) : null,
    groups === null
      ? h("p", { style: { opacity: 0.6 } }, P.loading)
      : !groups.length
        ? h("p", { style: { opacity: 0.6 } }, P.none)
        : groups.map((g) =>
            h(
              "section",
              { key: g.slug, style: { border: line, borderRadius: 10, overflow: "hidden" } },
              h("div", { style: { padding: "10px 16px", borderBottom: line, fontWeight: 600, fontSize: 14, background: "var(--color-kumo-recessed, var(--color-kumo-tint))" } }, g.label),
              g.fields.map((f, i) => {
                const other = f.widget && f.widget !== WIDGET ? f.widget : "";
                return h(
                  "div",
                  { key: f.slug, style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "12px 16px", borderTop: i ? line : "none" } },
                  h(
                    "div",
                    { style: { minWidth: 0 } },
                    h("div", { style: { fontSize: 14, fontWeight: 500 } }, f.label),
                    h("div", { style: { fontSize: 12, opacity: 0.6 } }, `${f.slug} · ${P.sub(f.subFields)}${other ? ` · ${P.other(other)}` : ""}`),
                  ),
                  h(Switch, { checked: f.widget === WIDGET, disabled: Boolean(busy[`${g.slug}/${f.slug}`]) || Boolean(other), onCheckedChange: (on) => toggle(g.slug, f, on), "aria-label": f.label }),
                );
              }),
            ),
          ),
  );
}

export const fields = { cards: Cards };
export const pages = { "/": Settings };
