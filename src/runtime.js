/**
 * The runtime of origin-emdash-cards: nothing server side, the widget and the
 * settings page (`admin.js`) do everything. It declares both, so the admin
 * lists them.
 */
import { definePlugin } from "emdash";
import { PLUGIN_ID } from "./index.js";

export function createPlugin() {
  return definePlugin({
    id: PLUGIN_ID,
    version: "1.0.0",
    capabilities: [],
    admin: {
      fieldWidgets: [{ name: "cards", label: "Cards + slide-out panel", fieldTypes: ["repeater"] }],
      // The settings page (`admin.js` → `pages["/"]`): listed in the admin sidebar under Plugins.
      pages: [{ path: "/", label: "Cards", icon: "cards" }],
    },
  });
}
