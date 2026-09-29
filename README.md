# origin-emdash-cards

Craft-style repeaters for [EmDash](https://github.com/emdash-cms/emdash): each item as a **card**, edited in a **slide-out panel**.

EmDash edits a repeater as a column of stacked, expandable rows. This plugin shows the items as a grid of cards (thumbnail, title, summary, drag to reorder) and edits one item at a time in a panel on the right, like Craft's slideouts. The stored value is the same, with the same sub-fields, so drafts, autosave, preview and revisions keep working.

Requires EmDash 1.x. It is a **native** (trusted) plugin, because the widget is React. It is installed from git, not from the EmDash plugin registry: the registry only takes sandboxed plugins.

## Install

```bash
bun add github:stephanedemotte/origin-emdash-cards#v1.0.0
```

```js
// astro.config.mjs
import emdash from "emdash/astro";
import { cards } from "origin-emdash-cards";

emdash({ plugins: [cards()] });
```

## Turn it on for a repeater

Pick **one** of the two ways per project. A schema script that writes widgets would overwrite the switches.

- **From the admin.** Go to Plugins → **Cards**. Every repeater of every collection is listed with a switch, and the editor picks the change up right away.
- **In code.** Set the widget on the repeater field:

  ```js
  { slug: "team", label: "Team", type: "repeater", widget: "origin-emdash-cards:cards",
    options: { title: "name", subtitle: "role", image: "photo" },
    validation: { subFields: [/* … */] } }
  ```

**Widget options, all optional.** They are slugs of sub-fields:

| Option | What it shows on the card | Default |
|---|---|---|
| `title` | the card's title | the first text sub-field |
| `subtitle` | the line under the title | the next text sub-field |
| `image` | the thumbnail | the first image sub-field |
| `help` | a line shown under the field's label | none |

## In the editor

- **The cards.** Each card shows a thumbnail, a title and a summary. When no item has an image, the cards are compact. An item with only an image is titled by its alt text or file name.
- **Adding and reordering.** "+ Add" creates an item and opens it. To reorder, drag a card, or select it and press **Alt + arrows**; **Escape** cancels a drag.
- **The panel.** A click opens the item in a panel on the right, with the admin's own inputs. Images come from the admin's media library. **← →** go to the previous or next item; **Done**, ✕, Escape or a click outside closes the panel. "Remove" deletes the item after a confirmation.
- **Saving.** Edits apply as you type, exactly like the built-in repeater.

Repeater sub-fields are limited by EmDash to string, text, url, number, integer, boolean, datetime, select and image. All of them are supported.

## How it works

- **The widget.** A React field widget for `repeater` fields. The admin passes it the value, `onChange`, the sub-fields (`validation.subFields`) and the widget `options`.
- **The inputs.** Each sub-field is rendered with the Kumo component the admin itself uses. Images go through the admin's exported `MediaPickerModal` and are stored in the admin's own value shape. Nothing downstream can tell this widget from the built-in one.
- **The panel.** Kumo's `Dialog` primitive (Base UI). The popup stays mounted through its exit transition, so the backdrop and the page's `inert` state are always cleaned up.
- **Reordering.** Pointer events, not the browser's HTML5 drag and drop, whose session can get stuck and freeze the page.
- **The settings page.** It writes the field's `widget` through EmDash's public schema API.

## Upstream

A widget picker in the field editor (Content Types → edit field) would make the settings page unnecessary: the admin already knows every plugin's widgets and the field types they edit.

## License

MIT
