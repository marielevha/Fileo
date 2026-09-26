"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";

type FieldRow = {
  id: string;
  label: string;
  unit: string;
};

const DEFAULT_UNITS = ["cm", "mm", "m"];

export default function TemplateFieldsInput({ initialFields, units }: { initialFields: Array<{ label: string; unit: string }>; units: string[] }) {
  const unitOptions = useMemo(() => {
    const configured = units.length ? units : DEFAULT_UNITS;
    return Array.from(new Set([...configured, ...initialFields.map((field) => field.unit).filter(Boolean)]));
  }, [initialFields, units]);
  const [rows, setRows] = useState<FieldRow[]>(
    initialFields.length
      ? initialFields.map((field) => ({ id: makeId(), label: field.label, unit: field.unit || "cm" }))
      : [{ id: makeId(), label: "", unit: "cm" }],
  );
  const serialised = useMemo(
    () => rows.map((row) => `${row.label.trim()} | ${row.unit.trim() || "cm"}`).filter((line) => !line.startsWith(" |")).join("\n"),
    [rows],
  );

  function updateRow(id: string, values: Partial<FieldRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...values } : row)));
  }

  function addRow() {
    setRows((current) => [...current, { id: makeId(), label: "", unit: "cm" }]);
  }

  function removeRow(id: string) {
    setRows((current) => current.length > 1 ? current.filter((row) => row.id !== id) : [{ id: makeId(), label: "", unit: "cm" }]);
  }

  return (
    <div className="rounded-xl border border-base-300 bg-base-100">
      <input type="hidden" name="fields" value={serialised} />
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Mesure</th>
            <th className="w-28">Unite</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <input
                  value={row.label}
                  onChange={(event) => updateRow(row.id, { label: event.target.value })}
                  placeholder="Poitrine"
                  className="input input-bordered input-sm w-full"
                />
              </td>
              <td>
                <select
                  value={row.unit}
                  onChange={(event) => updateRow(row.id, { unit: event.target.value })}
                  className="select select-bordered select-sm w-full"
                >
                  {unitOptions.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </td>
              <td>
                <button type="button" onClick={() => removeRow(row.id)} className="btn btn-ghost btn-square btn-xs" aria-label="Retirer la mesure">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-base-300 p-2 text-right">
        <button type="button" onClick={addRow} className="btn btn-ghost btn-sm">
          Ajouter une mesure
        </button>
      </div>
    </div>
  );
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `field-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
