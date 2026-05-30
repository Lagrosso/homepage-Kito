import ConfigEditor from "components/admin/config-editor";
import { parseSettings } from "utils/config/settings-preview";

// Read-only card for one settings field. Values are already masked by
// parseSettings/maskValue, so a real secret never reaches the DOM (not in text,
// not in title tooltips). Redacted fields render as "[redacted]".
function SettingsCard({ entry }) {
  return (
    <div className="mb-2 rounded-md font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
      <div className="px-3 pt-2 text-xs font-semibold">{entry.key}</div>
      <div className="px-3 pb-2 text-xs">
        {entry.redacted ? (
          <span className="font-mono italic text-theme-400 dark:text-theme-500">{entry.value}</span>
        ) : (
          <span className="block truncate font-mono text-theme-700 dark:text-theme-300" title={entry.value}>
            {entry.value || "—"}
          </span>
        )}
      </div>
    </div>
  );
}

// Preview-only editor: no AddDialog / insert props -> the shared shell hides the
// quick-add button. Raw editing, validation, backups and atomic writes are
// reused unchanged from ConfigEditor / config-writer.
export default function AdminSettingsConfig() {
  return (
    <ConfigEditor
      configFile="settings.yaml"
      parse={parseSettings}
      Card={SettingsCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
    />
  );
}
