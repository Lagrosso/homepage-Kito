import ConfigEditor from "components/admin/config-editor";
import yaml from "js-yaml";

function parseDocker(content) {
  const data = yaml.load(content);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  const entries = Object.entries(data).map(([name, value]) => ({
    name,
    host: value?.host,
    port: value?.port,
    socket: value?.socket,
    protocol: value?.protocol,
    swarm: value?.swarm,
  }));

  return entries.length ? [{ name: "Docker Servers", entries }] : [];
}

function DockerCard({ entry }) {
  return (
    <div className="mb-2 rounded-md bg-theme-100/20 p-3 text-sm text-theme-700 shadow-md shadow-theme-900/10 dark:bg-white/5 dark:text-theme-200 dark:shadow-theme-900/20">
      <div className="font-semibold">{entry.name}</div>
      <dl className="mt-2 flex flex-col gap-1 text-xs">
        {entry.socket && (
          <div className="flex gap-2">
            <dt className="text-theme-500 dark:text-theme-400">socket</dt>
            <dd className="font-mono">{entry.socket}</dd>
          </div>
        )}
        {entry.host && (
          <div className="flex gap-2">
            <dt className="text-theme-500 dark:text-theme-400">host</dt>
            <dd className="font-mono">
              {entry.protocol ? `${entry.protocol}://` : ""}
              {entry.host}
              {entry.port ? `:${entry.port}` : ""}
            </dd>
          </div>
        )}
        {entry.swarm !== undefined && (
          <div className="flex gap-2">
            <dt className="text-theme-500 dark:text-theme-400">swarm</dt>
            <dd className="font-mono">{String(entry.swarm)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export default function AdminDockerConfig() {
  return (
    <ConfigEditor
      configFile="docker.yaml"
      title="Docker Config"
      parse={parseDocker}
      Card={DockerCard}
      gridClassName="grid grid-cols-1 sm:grid-cols-2 gap-3"
    />
  );
}
