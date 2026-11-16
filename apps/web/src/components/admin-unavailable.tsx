import { EmptyState, PageHeader } from "@verasjuris/ui";

/** Estado honesto para módulos administrativos ainda sem backend completo. */
export function AdminUnavailable({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="vj-stack">
      <PageHeader title={title} description={description} />
      <EmptyState title="Funcionalidade em desenvolvimento">
        Esta área administrativa ainda não está disponível para operação. Nenhuma ação foi
        executada e nenhum dado fictício é apresentado como real.
      </EmptyState>
    </div>
  );
}
