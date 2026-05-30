import ConfigEditor from "components/admin/config-editor";
import { parseWidgets } from "utils/config/widget-preview";

// Read-only card for one info widget. Values are already masked by
// parseWidgets/maskWidgetOptions, so the real secret never reaches the DOM
// (not in text, not in title tooltips). Redacted fields render as "[redacted]".
function WidgetCard({ entry }) {
  return (
    <div className="mb-2 rounded-md font-medium text-theme-700 dark:text-theme-200 shadow-md shadow-theme-900/10 dark:shadow-theme-900/20 bg-theme-100/20 dark:bg-white/5">
      <div className="px-3 py-2 border-b border-theme-300/60 dark:border-theme-700/60 text-sm font-semibold">
        {entry.type}
      </div>
      {entry.fields.length > 0 ? (
        <dl className="px-3 py-2 flex flex-col gap-1">
          {entry.fields.map((field) => (
            <div key={field.key} className="flex gap-2 text-xs">
              <dt className="shrink-0 text-theme-500 dark:text-theme-400 font-medium">{field.key}</dt>
              {field.redacted ? (
                <dd className="font-mono italic text-theme-400 dark:text-theme-500">{field.value}</dd>
              ) : (
                <dd className="min-w-0 truncate font-mono text-theme-700 dark:text-theme-300" title={field.value}>
                  {field.value}
                </dd>
              )}
            </div>
          ))}
        </dl>
      ) : (
        <p className="px-3 py-2 text-xs text-theme-500">No options.</p>
      )}
    </div>
  );
}

// Preview-only editor: no AddDialog / insert props -> the shared shell hides
// the quick-add button. Raw editing, validation, backups and atomic writes are
// reused unchanged from ConfigEditor / config-writer.
export default function AdminWidgetsConfig() {
  return (
    <ConfigEditor
      configFile="widgets.yaml"
      parse={parseWidgets}
      Card={WidgetCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-3"
    />
  );
}
