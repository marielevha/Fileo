"use client";

import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";

export default function MeasurementUnitsInput({ initialUnits }: { initialUnits: string[] }) {
  const [units, setUnits] = useState<string[]>(initialUnits.length ? initialUnits : ["cm", "mm", "m"]);
  const serialised = useMemo(() => units.map((unit) => unit.trim()).filter(Boolean).join(","), [units]);

  function updateUnit(index: number, value: string) {
    setUnits((current) => current.map((unit, unitIndex) => (unitIndex === index ? value.toLowerCase() : unit)));
  }

  function addUnit() {
    setUnits((current) => [...current, ""]);
  }

  function removeUnit(index: number) {
    setUnits((current) => {
      const next = current.filter((_, unitIndex) => unitIndex !== index);
      return next.length ? next : ["cm"];
    });
  }

  return (
    <div className="grid gap-3">
      <input type="hidden" name="measurementUnits" value={serialised} />
      <div className="grid gap-2">
        {units.map((unit, index) => (
          <div key={`${index}-${unit}`} className="flex items-center gap-2">
            <input
              value={unit}
              onChange={(event) => updateUnit(index, event.target.value)}
              placeholder="cm"
              maxLength={12}
              className="input input-bordered input-sm flex-1"
            />
            <button type="button" onClick={() => removeUnit(index)} className="btn btn-ghost btn-square btn-sm" aria-label="Retirer l'unite">
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addUnit} className="btn btn-ghost btn-sm justify-self-start">
        Ajouter une unite
      </button>
    </div>
  );
}
