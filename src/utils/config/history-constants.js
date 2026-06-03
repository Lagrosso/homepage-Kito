import { EDITABLE_CONFIGS } from "utils/config/editable-files";

export const HISTORY_ACTIONS = ["save", "restore"];
export const HISTORY_FILES = [...EDITABLE_CONFIGS, "custom.css"];

export const HISTORY_ROUTE_BY_FILE = {
  "services.yaml": "/admin/config",
  "bookmarks.yaml": "/admin/bookmarks",
  "widgets.yaml": "/admin/widgets",
  "settings.yaml": "/admin/settings",
  "docker.yaml": "/admin/docker",
  "custom.css": "/admin/theme",
};
