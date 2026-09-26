import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import { deleteArticleTemplateAction, saveArticleTemplateAction, saveMeasurementUnitsAction } from "@/lib/actions/article-templates";
import { requireWorkshop } from "@/lib/auth/guards";
import { listArticleTemplates, type ArticleTemplate } from "@/lib/repos/article-templates";
import { getWorkshopMeasurementUnits } from "@/lib/repos/workshops";
import MeasurementUnitsInput from "./MeasurementUnitsInput";
import TemplateFieldsInput from "./TemplateFieldsInput";

export const metadata: Metadata = {
  title: "Parametres atelier",
  robots: { index: false, follow: false },
};

export default async function WorkshopSettingsPage() {
  const { workshop } = await requireWorkshop("templates.manage");
  const [templates, measurementUnits] = await Promise.all([
    listArticleTemplates(workshop.id, { includeInactive: true }),
    getWorkshopMeasurementUnits(workshop.id),
  ]);

  return (
    <>
      <PageHeader
        title="Parametres atelier"
        description="Configurez les types d'articles et les mensurations proposees pendant la saisie."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="rounded-2xl border border-base-300 bg-base-100">
          <div className="border-b border-base-300 px-5 py-4">
            <h2 className="font-display font-bold">Modeles existants</h2>
            <p className="mt-1 text-sm text-base-content/55">
              Ces modeles accelerent la creation de commande sur le web et le mobile.
            </p>
          </div>
          <div className="divide-y divide-base-300">
            {templates.length ? templates.map((template) => (
              <TemplateEditor key={template.id} measurementUnits={measurementUnits} template={template} />
            )) : (
              <p className="px-5 py-10 text-center text-sm text-base-content/55">
                Aucun modele configure pour le moment.
              </p>
            )}
          </div>
        </section>

        <aside className="grid h-fit gap-6">
          <section className="rounded-2xl border border-base-300 bg-base-100 p-5">
            <h2 className="font-display font-bold">Unites de mensuration</h2>
            <p className="mt-1 text-sm text-base-content/55">
              Ces unites sont proposees dans les modeles, les commandes et l'application mobile.
            </p>
            <form action={saveMeasurementUnitsAction} className="mt-4 grid gap-4">
              <MeasurementUnitsInput initialUnits={measurementUnits} />
              <button type="submit" className="btn btn-primary">Enregistrer les unites</button>
            </form>
          </section>

          <section className="rounded-2xl border border-base-300 bg-base-100 p-5">
            <h2 className="font-display font-bold">Nouveau modele</h2>
            <p className="mt-1 text-sm text-base-content/55">
              Configurez les mesures attendues et leur unite par defaut.
            </p>
            <TemplateForm measurementUnits={measurementUnits} />
          </section>
        </aside>
      </div>
    </>
  );
}

function TemplateEditor({ template, measurementUnits }: { template: ArticleTemplate; measurementUnits: string[] }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{template.name}</h3>
            <span className="badge badge-ghost badge-sm">{template.defaultWorkType === "retouche" ? "Retouche" : "Creation"}</span>
            {!template.active ? <span className="badge badge-warning badge-sm">Inactif</span> : null}
          </div>
          <p className="mt-1 text-sm text-base-content/55">
            {template.fields.length ? template.fields.map((field) => field.label).join(", ") : "Aucune mensuration proposee"}
          </p>
        </div>
        <span className="text-sm font-medium text-primary group-open:hidden">Modifier</span>
      </summary>
      <div className="px-5 pb-5">
        <TemplateForm measurementUnits={measurementUnits} template={template} />
        <form action={deleteArticleTemplateAction} className="mt-3 text-right">
          <input type="hidden" name="id" value={template.id} />
          <button type="submit" className="btn btn-ghost btn-sm text-error">
            Supprimer le modele
          </button>
        </form>
      </div>
    </details>
  );
}

function TemplateForm({ template, measurementUnits }: { template?: ArticleTemplate; measurementUnits: string[] }) {
  return (
    <form action={saveArticleTemplateAction} className="mt-4 grid gap-4">
      <input type="hidden" name="id" value={template?.id ?? ""} />
      <label className="form-control">
        <span className="label-text mb-2 font-medium">Article</span>
        <input name="name" defaultValue={template?.name ?? ""} placeholder="Robe, pantalon, chemise..." className="input input-bordered" required />
      </label>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <label className="form-control">
          <span className="label-text mb-2 font-medium">Type par defaut</span>
          <select name="defaultWorkType" defaultValue={template?.defaultWorkType ?? "creation"} className="select select-bordered">
            <option value="creation">Creation</option>
            <option value="retouche">Retouche</option>
          </select>
        </label>
        <label className="form-control">
          <span className="label-text mb-2 font-medium">Ordre</span>
          <input name="sortOrder" type="number" min={0} defaultValue={template?.sortOrder ?? 0} className="input input-bordered" />
        </label>
      </div>
      <label className="form-control">
        <span className="label-text mb-2 font-medium">Description</span>
        <input name="description" defaultValue={template?.description ?? ""} placeholder="Usage interne optionnel" className="input input-bordered" />
      </label>
      <div className="form-control">
        <span className="label-text mb-2 font-medium">Mensurations proposees</span>
        <TemplateFieldsInput initialFields={template?.fields.map((field) => ({ label: field.label, unit: field.unit || "cm" })) ?? []} units={measurementUnits} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input name="active" type="checkbox" defaultChecked={template?.active ?? true} className="checkbox checkbox-primary checkbox-sm" />
        Actif dans les formulaires
      </label>
      <button type="submit" className="btn btn-primary">
        {template ? "Enregistrer les modifications" : "Creer le modele"}
      </button>
    </form>
  );
}
