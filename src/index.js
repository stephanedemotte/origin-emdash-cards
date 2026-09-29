/**
 * origin-emdash-cards — Craft-style repeaters for EmDash.
 *
 * EmDash edits a repeater as a column of stacked, expandable rows. This plugin
 * contributes a field widget, `origin-emdash-cards:cards`, that shows the
 * items as a grid of CARDS (thumbnail, title, summary) and edits one item at a
 * time in a SLIDE-OUT PANEL, like Craft's slideouts. Same stored value, same
 * sub-fields: drafts, autosave, preview and revisions keep working.
 *
 * Turn it on per repeater field, either from the plugin's admin page
 * (Plugins → Cards: a switch per repeater), or in your schema code with
 * `widget: "origin-emdash-cards:cards"`. Pick ONE source per project: a
 * schema script that writes widgets will overwrite the switches.
 * Optional widget `options`: `title` (sub-field slug shown as the card title),
 * `subtitle`, `image` — by default the first text sub-field, the next one,
 * and the first image sub-field.
 */
import { fileURLToPath } from "node:url";

export const PLUGIN_ID = "origin-emdash-cards";
export const WIDGET = `${PLUGIN_ID}:cards`;

/** The plugin descriptor, for `emdash({ plugins: [cards()] })`. Native format: the widget is React. */
export const cards = () => ({
  id: PLUGIN_ID,
  version: "1.0.0",
  format: "native",
  entrypoint: fileURLToPath(new URL("./runtime.js", import.meta.url)),
  adminEntry: fileURLToPath(new URL("./admin.js", import.meta.url)),
  capabilities: [],
  // A settings page: every repeater of every collection, with a switch.
  adminPages: [{ path: "/", label: "Cards" }],
});
